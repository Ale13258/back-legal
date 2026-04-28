# Tooling Guide: Risk Checklist

Checklist mental para cualquier cambio con impacto funcional.

## Preguntas obligatorias

1. ¿Qué contrato puede romperse?
2. ¿Qué flujo depende indirectamente de este archivo?
3. ¿Qué caso borde no cubre la solución?
4. ¿Hay impacto en performance, loading o errores?
5. ¿El cambio es reversible si falla?

## Riesgos típicos a revisar

- regresiones por estado compartido
- dependencias implícitas entre hooks y componentes
- datos nulos o shape inesperado
- diferencias entre SSR, CSR o hidratación si aplica
- deuda técnica añadida por condicionales o duplicación

## Cierre mínimo

- riesgo principal identificado
- validación ejecutada o pendiente
- limitación conocida documentada
