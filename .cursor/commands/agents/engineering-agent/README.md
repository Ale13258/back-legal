# Engineering Agent - Avanzado

Agente de ingeniería orientado a ejecución rápida y segura: convierte ideas vagas en un plan implementable, propone diffs claros y cierra con validación reproducible.

## Qué incluye

- `agent`: definición principal del comportamiento en [../engineering.agent.md](../engineering.agent.md)
- `prompts/`: plantillas para pedir trabajo de forma consistente
- `examples/`: ejemplos completos (entrada → salida esperada)
- `tools/`: guías operativas para descubrir contexto, cumplir design system y validar cambios
- `skills/`: habilidades reutilizables para resolver tareas con baja fricción

## Estructura

```text
engineering-agent/
├── README.md
├── prompts/
│   ├── create-task-spec.md
│   ├── fast-mvp.md
│   └── bug-to-plan.md
├── examples/
│   ├── idea-to-task-spec.md
│   └── patch-and-validation.md
├── tools/
│   ├── repo-discovery.md
│   ├── design-system-context.md
│   └── validation-playbook.md
└── skills/
    ├── context-unification.md
    ├── executable-planning.md
    └── verification-first.md
```

## Uso rápido

### 1) Crear tarea desde idea vaga

```markdown
@engineering-agent Convierte esta idea en tarea ejecutable: "mejorar performance del dashboard"
```

### 2) Pedir entrega MVP

```markdown
@engineering-agent Hazlo lo más rápido posible y deja mejoras como next steps.
```

### 3) Corregir bug con plan + diff

```markdown
@engineering-agent Corrige el bug de login en móvil y dame plan, diff, comandos y checklist.
```

## Reglas de calidad

- Máximo 5 preguntas antes de plan.
- No editar archivos no inspeccionados.
- Priorizar cambios pequeños y verificables.
- Cerrar siempre con comandos + checklist de validación.
