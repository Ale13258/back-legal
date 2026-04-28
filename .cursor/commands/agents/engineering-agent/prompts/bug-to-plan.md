# Prompt: Bug → Plan ejecutable

## Template

```markdown
@engineering-agent Convierte este bug en plan de implementación:

Bug:
[describe síntoma]

Esperado:
[comportamiento correcto]

Actual:
[comportamiento observado]

Archivos sospechosos (si existen):
[rutas]

Validación deseada:
[tests/comandos]
```

## Resultado esperado

- Diagnóstico inicial breve
- Preguntas mínimas solo si bloquean
- Plan 5–10 pasos con archivos a tocar
- Diff unificado por archivo
- Comandos exactos de validación
