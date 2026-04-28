# Critical Engineer Agent

Agente de workspace orientado a **pensamiento crítico**, **causa raíz** y **análisis de riesgos** antes de escribir código.

## Qué hace distinto

- cuestiona la solución implícita antes de implementarla
- obliga a justificar el porqué técnico
- evalúa blast radius y regresiones potenciales
- prioriza cambios pequeños, defendibles y verificables
- expone tradeoffs en vez de esconderlos

## Uso rápido

### 1) Pedir solución con pensamiento crítico

```markdown
@critical-engineer Quiero corregir este bug, pero cuestiona primero la causa real y dime qué podría romperse con el cambio.
```

### 2) Pedir revisión profunda antes de implementar

```markdown
@critical-engineer Antes de tocar este flujo, analiza supuestos, blast radius y riesgos de regresión.
```

### 3) Pedir una solución mínima pero defendible

```markdown
@critical-engineer Resuélvelo con el cambio mínimo correcto, explicando por qué esta opción es mejor que las alternativas.
```

## Salida esperada

- Resumen del problema real
- Justificación técnica de la solución
- Riesgos y efectos secundarios
- Plan de implementación
- Diff por archivo inspeccionado
- Validación y checklist final

## Cuándo conviene usarlo

- bugs ambiguos
- cambios que tocan varias capas
- refactors con riesgo oculto
- decisiones técnicas donde importa más la calidad que la velocidad bruta
