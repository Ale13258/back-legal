# Tooling Guide: Repo Discovery

Guía para descubrir contexto antes de preguntar.

## Orden recomendado

1. Detectar stack por archivos raíz
   - `package.json`, `pnpm-lock.yaml`, `yarn.lock`
   - `pyproject.toml`, `requirements.txt`
   - `pom.xml`, `build.gradle`, `Cargo.toml`
2. Identificar framework y entrypoints
3. Localizar scripts de validación (lint/test/build/type-check)
4. Localizar módulo objetivo por rutas y nombres
5. Solo si falta dato crítico: preguntar

## Resultado esperado

- Stack probable
- Rutas candidatas a editar
- Comandos de validación disponibles
- Riesgos de cambio
