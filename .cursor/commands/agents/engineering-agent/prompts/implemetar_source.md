Prompt
Creacion de sources:

Implementa un nuevo data source para [NOMBRE_DEL_SOURCE] siguiendo el patrón establecido de Instagram y TikTok.

Adjuntar:

- Ícono del source (imagen): @public/images/datasource/[nombre].png o .jpg
- APIs del backend (si existen): @src/api/source/source.ts (líneas del nuevo source)

Información del nuevo source:

- Nombre: [Nombre del Source]
- Tipo de autenticación: OAuth / API Key / File Upload
- Descripción: [Breve descripción del source]
- Requiere inputs adicionales: Sí/No (especificar cuáles: region, propertyId, etc.)

Pasos a implementar:

1. **Constantes** - Crear constante del tipo en:

   - @src/components/project/components/tabsTwo/AddDataSource.utils.tsx

2. **APIs** - Asegurar que existan en:

   - @src/api/source/source.ts
   - `post[SourceName]AuthUrl` (para OAuth)
   - `addOAuthSource[SourceName]` (para crear conexión)

3. **Card en UI** - Agregar al final del array en:

   - @src/components/AddDataSource/useAddDataSource.ts (cardsInit)
   - Usar el siguiente ID disponible
   - Incluir imagen, descripción, section: 'apps'

4. **OAuth Flow** - Agregar case para el nuevo ID en:

   - @src/components/AddDataSource/useAddDataSource.ts (handleConnect)

5. **Validación** - Configurar inputs requeridos en:

   - @src/components/AddDataSource/useAddDataSource.ts (isFormValid)
   - @src/components/AddDataSource/useAddDataSource.ts (getInputPlaceholders)

6. **UI Inputs** - Si solo requiere nombre, agregar ID a la exclusión en:

   - @src/components/AddDataSource/AddDataSource.tsx

7. **Save Function** - Crear función [sourceName]Save en:

   - @src/components/project/components/tabsTwo/useAddDataSource.tsx
   - Incluir sistema de locks (\_executing)
   - Manejar success/error

8. **OAuth Check** - Agregar verificación de tipo en:

   - @src/components/AddDataSource/useAddDataSource.ts (useEffect OAuth)

9. **Export Hook** - Exportar [sourceName]Save en:

   - @src/components/project/components/tabsTwo/useAddDataSource.tsx (return)

10. **Importar Hook** - Destructurar [sourceName]Save en:

    - @src/components/AddDataSource/useAddDataSource.ts (useAddDataSourceLogic)

11. **Session Cleanup** - Agregar [sourceName]Save_executing en:

    - @src/components/project/components/tabsTwo/useAddDataSource.tsx (showStatusMessage - 2 lugares)

12. **Iconos** - Agregar mapeo del ícono en:

    - @src/components/datasource/datasource.tsx (typeIcons)

13. **Format Type** - Agregar formateo del nombre en:
    - @src/components/datasource/datasource.tsx (formatSourceType)
    - @src/components/project/components/tabsTwo/selectDataSource/SelectDataSource.tsx (formatSourceType)

Validación final:

- Ejecutar linter y corregir errores
- Verificar que el source siempre se agregue al FINAL de la lista
- No afectar IDs de sources existentes
- Probar el flujo completo de OAuth

Nota: Usar como referencia los sources de Instagram (ID 10) o TikTok (ID 11) que siguen este patrón exacto.
