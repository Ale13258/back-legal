# Ejemplo: Idea vaga → Task Spec accionable

## Input

```markdown
@engineering-agent Quiero mejorar la experiencia del login.
```

## Output esperado (resumen)

- **Resumen**: convertir mejora ambigua en tarea concreta.
- **Supuestos**: login en app web Next.js; auth actual existente.
- **Plan**:
  1. Revisar flujo actual (UI + hooks + API)
  2. Detectar fricciones (errores, loading, mensajes)
  3. Definir alcance MVP
  4. Ajustar estados y feedback visual
  5. Mejorar manejo de errores
  6. Añadir validación de formulario
  7. Verificar en desktop/mobile
  8. Ejecutar lint/type-check
- **Comandos**: install/build/lint/test
- **Checklist**: estados cubiertos, errores legibles, no regresiones
