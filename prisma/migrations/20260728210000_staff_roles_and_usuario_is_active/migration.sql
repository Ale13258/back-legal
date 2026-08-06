-- Reemplaza role_enum admin/cliente por super_admin/analista_legal/abogada_junior/cliente
-- y añade soft-delete is_active en usuarios.

ALTER TABLE "usuarios" DROP CONSTRAINT IF EXISTS "usuarios_cliente_role_chk";

ALTER TABLE "usuarios" ALTER COLUMN "role" TYPE TEXT USING "role"::text;

UPDATE "usuarios" SET "role" = 'super_admin' WHERE "role" = 'admin';

DROP TYPE "role_enum";

CREATE TYPE "role_enum" AS ENUM ('super_admin', 'analista_legal', 'abogada_junior', 'cliente');

ALTER TABLE "usuarios"
  ALTER COLUMN "role" TYPE "role_enum" USING "role"::"role_enum";

ALTER TABLE "usuarios"
  ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_cliente_role_chk" CHECK (
  ("role" = 'cliente'::role_enum AND "cliente_id" IS NOT NULL)
  OR (
    "role" IN (
      'super_admin'::role_enum,
      'analista_legal'::role_enum,
      'abogada_junior'::role_enum
    )
    AND "cliente_id" IS NULL
  )
);
