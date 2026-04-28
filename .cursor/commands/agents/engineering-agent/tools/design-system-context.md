# Tooling Guide: Design System Context

Guía de contexto máximo para que el agente proponga cambios UI consistentes con Tinkery.ai.

## Reglas no negociables

1. Usar componentes compartidos en lugar de HTML nativo para interacción.
2. Usar tokens `COLORS` para todos los colores.
3. Respetar imports canónicos del repo.
4. Evitar introducir librerías de UI nuevas sin necesidad.

## Imports recomendados

```tsx
import { Button } from 'utils/shared/button'
import Input from 'utils/shared/input/Input'
import { COLORS } from 'utils/shared/color/color'
import Selector from 'utils/shared/dropdown/Dropdown'
import { Menu, MenuItem } from 'utils/shared/menu/Menu'
import Pagination from 'utils/shared/pagination/Pagination'
import ErrorModal from 'utils/shared/modal_error/ErrorModal'
import TableContainer from 'utils/shared/components_table/TableContainer'
import ButtonTable from 'utils/shared/components_table/button_table/ButtonTable'
import TopRightBadge from 'utils/shared/card_notification/TopRightBadge'
```

## Tokens de color clave

- `COLORS.PRIMARY`
- `COLORS.SECONDARY`
- `COLORS.SUCCESS`
- `COLORS.ERROR`
- `COLORS.WARNING`
- `COLORS.TEXT_PRIMARY`
- `COLORS.TEXT_REGULAR`
- `COLORS.BORDER_LIGHT`

## Mini ejemplo de corrección

```tsx
// ❌ Antes
;<button style={{ color: '#F76621' }}>Guardar</button>

// ✅ Después
import { Button } from 'utils/shared/button'
import { COLORS } from 'utils/shared/color/color'
;<Button variant='primary' style={{ color: COLORS.WHITE, backgroundColor: COLORS.PRIMARY }}>
  Guardar
</Button>
```

## Checklist rápido previo a entregar

- [ ] No hay `<button>`, `<input>`, `<select>` en UI final cuando exista componente compartido
- [ ] No hay hex hardcodeados en cambios nuevos
- [ ] Los imports de diseño son de `utils/shared/*`
- [ ] El diff mantiene cambios mínimos
