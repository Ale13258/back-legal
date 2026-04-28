# Ejemplo: Plan + Diff + Validación

## Input

```markdown
@engineering-agent Corrige el bug: botón Guardar queda deshabilitado aunque el formulario sea válido.
```

## Output esperado (resumen)

1. Localizar condición de disabled en componente y hook.
2. Corregir lógica booleana en un cambio mínimo.
3. Entregar diff unificado por archivo tocado.
4. Cerrar con comandos:

```bash
npm install
npm run lint
npm run type-check
npm run test
```

5. Checklist final:

- [ ] Botón se habilita cuando form es válido
- [ ] Botón se deshabilita al enviar
- [ ] No rompe validaciones existentes

## Ejemplo de código (diff unificado)

```diff
diff --git a/src/components/ProfileForm/ProfileForm.tsx b/src/components/ProfileForm/ProfileForm.tsx
index 8b12345..9c98765 100644
--- a/src/components/ProfileForm/ProfileForm.tsx
+++ b/src/components/ProfileForm/ProfileForm.tsx
@@ -1,9 +1,10 @@
 import React from 'react'
-import { Button } from '@mui/material'
+import { Button } from 'utils/shared/button'
+import { COLORS } from 'utils/shared/color/color'

 import { useProfileForm } from './useProfileForm'

 export default function ProfileForm() {
	 const { isValid, isSubmitting, onSubmit } = useProfileForm()
-  const isDisabled = !isValid || isSubmitting || true
+  const isDisabled = !isValid || isSubmitting

	 return (
		 <form onSubmit={onSubmit}>
@@ -15,7 +16,7 @@ export default function ProfileForm() {
-      <Button disabled={isDisabled} type='submit'>Guardar</Button>
+      <Button disabled={isDisabled} type='submit' style={{ backgroundColor: COLORS.PRIMARY }}>Guardar</Button>
		 </form>
	 )
 }
```

### Qué demuestra este ejemplo

1. Corrige la lógica del bug con cambio mínimo (`isDisabled`).
2. Usa **sistema de diseño** (Button compartido + `COLORS.PRIMARY`).
3. Mantiene un diff pequeño y verificable.
