# Tooling Guide: Validation Playbook

Cierre estándar para cualquier tarea del agente con enfoque **rápido, trazable y sin regresiones**.

## Objetivo

Definir una secuencia de validación que:

1. Detecte fallos temprano (tipos/lint/formato)
2. Aísle regresiones en el área tocada
3. Permita salida segura para merge/deploy

## Estrategia de validación (por capas)

### Capa 1: Sanidad local (siempre)

1. Verificar dependencias y lockfile
2. Ejecutar chequeos estáticos rápidos
3. Confirmar que no se rompió formato ni tipos

### Capa 2: Impacto funcional (según cambio)

- **UI/Componentes**: validar flujo visual y estados (loading/error/empty/success)
- **API/Data fetching**: validar contratos, errores y estados de red
- **Estado global (Redux/store)**: validar que no hay efectos colaterales
- **Infra/config**: validar build y arranque mínimo

### Capa 3: Salida de calidad

- Ejecutar validación consolidada del repo
- Cerrar con checklist de aceptación
- Documentar riesgos residuales

## Comandos reales del proyecto (Node/TS)

### Ruta rápida (recomendada)

```bash
npm run validate
```

### Ruta detallada

```bash
npm install
npm run type-check
npm run lint
npm run format:check
npm run build
```

### Corrección automática (cuando aplique)

```bash
npm run validate:fix
```

## Política de ejecución por tipo de tarea

### 1) Cambio pequeño de UI (1–3 archivos)

- Mínimo: `type-check` + `lint` + `format:check`
- Si toca render/rutas: agregar `build`

### 2) Cambio de lógica de negocio (hooks/services/store)

- Mínimo: `type-check` + `lint` + `format:check`
- Recomendado: `build`
- Verificar manualmente escenario feliz + escenario de error

### 3) Cambio transversal o refactor

- Obligatorio: `validate` + `build`
- Revisión de regresión en módulos dependientes

## Criterios de pase/fallo (gates)

### Gate A — Estático

- `type-check` sin errores
- `lint` sin errores en archivos tocados
- `format:check` sin diffs pendientes

### Gate B — Funcional

- Comportamiento esperado confirmado en el flujo tocado
- Estados de error y loading no rompen UI

### Gate C — Entrega

- Build exitoso cuando el cambio impacta runtime
- Checklist de aceptación completado
- Riesgos residuales documentados

## Protocolo cuando falla una validación

1. **No expandir alcance**: corregir solo lo que bloquea la tarea
2. **Priorizar causa raíz**: evitar “parches cosméticos”
3. **Reintentar en orden**:
   - `type-check`
   - `lint`
   - `format:check`
   - `build`
4. **Si hay fallos no relacionados**:
   - reportarlos
   - no resolverlos salvo que bloqueen el objetivo

## Plantilla de cierre (usar siempre)

```markdown
## Comandos ejecutados

- npm run type-check
- npm run lint
- npm run format:check
- npm run build

## Resultado

- Type-check: ✅/❌
- Lint: ✅/❌
- Format: ✅/❌
- Build: ✅/❌

## Checklist de validación

- [ ] Criterios de aceptación funcionales cumplidos
- [ ] No regresiones evidentes en el flujo tocado
- [ ] Design system respetado (si hubo cambios UI)
- [ ] Riesgos residuales documentados
```

## Notas del repo actual

- Existe `npm run validate` como comando consolidado (`type-check` + `lint` + `format:check`).
- No hay script `test` declarado en `package.json`; no asumir pruebas automáticas si no se agregan explícitamente.

## Ejemplo operativo (caso real)

### Escenario

Se corrige un bug en un formulario (`disabled` mal calculado) en 2 archivos TSX.

### Secuencia recomendada

```bash
npm run type-check
npm run lint
npm run format:check
npm run build
```

### Reporte esperado

```markdown
## Comandos ejecutados

- npm run type-check ✅
- npm run lint ✅
- npm run format:check ✅
- npm run build ✅

## Evidencia funcional

- [x] El botón se habilita cuando el formulario es válido
- [x] El botón se deshabilita durante submit
- [x] No hay cambios fuera del alcance
```

## Criterio de salida

- Sin errores en validaciones ejecutadas para el alcance del cambio
- Criterios de aceptación del usuario cumplidos
- Checklist final marcado y reproducible
