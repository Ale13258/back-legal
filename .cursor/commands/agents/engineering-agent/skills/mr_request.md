Genera el título y la descripción para un Merge Request (MR)

## Pasos

1. Preguntar al usuario por los commits que están incluidos en el MR
2. Preguntar al usuario si desea incluir contexto adicional que ayude a elaborar una descripción más robusta
3. Genera el titulo y la descripción del MR con el formato indicado, el resultado debe ser un markdown listo para copiar y pegar

## Formato

1. **Título del MR**: Debe ser claro, conciso y reflejar el objetivo principal del cambio. Sigue el formato:

   - `feat: ...` para nuevas funcionalidades
   - `fix: ...` para correcciones de bugs
   - `refactor: ...` para refactorizaciones
   - `chore: ...` para tareas de mantenimiento
   - `docs: ...` para documentación

2. **Descripción del MR**: Debe incluir:

   - **Resumen**: Breve descripción de qué hace el MR
   - **Cambios realizados**: Lista de los cambios principales
   - **Ticket relacionado**: Si aplica, incluir el número del ticket (ej: KAN-XXXX)
   - **Cómo probar**: Pasos para verificar los cambios (si aplica)
   - **Notas adicionales**: Cualquier información relevante para los revisores

3. Si el número de ticket está disponible en los commits o el contexto, inclúyelo en el título y la descripción.

4. Genera el resultado en formato markdown listo para copiar y pegar y crealo en un archivo para copiar.
