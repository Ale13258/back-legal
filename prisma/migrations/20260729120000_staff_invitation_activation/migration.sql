-- Invitación segura de staff: password nullable + token de activación.

ALTER TABLE "usuarios"
  ALTER COLUMN "password_hash" DROP NOT NULL;

ALTER TABLE "usuarios"
  ADD COLUMN IF NOT EXISTS "activation_token_hash" TEXT,
  ADD COLUMN IF NOT EXISTS "activation_expires_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "activated_at" TIMESTAMP(3);

-- Usuarios existentes con contraseña se consideran ya activados.
UPDATE "usuarios"
SET "activated_at" = COALESCE("activated_at", "created_at")
WHERE "password_hash" IS NOT NULL
  AND "activated_at" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "usuarios_activation_token_hash_key"
  ON "usuarios"("activation_token_hash");

-- Cliente siempre con password y activado.
ALTER TABLE "usuarios" DROP CONSTRAINT IF EXISTS "usuarios_cliente_password_chk";
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_cliente_password_chk" CHECK (
  "role" <> 'cliente'::role_enum
  OR (
    "password_hash" IS NOT NULL
    AND "activated_at" IS NOT NULL
    AND "activation_token_hash" IS NULL
  )
);

-- Staff pendiente: sin password/activación, con token + expiración, is_active=false.
-- Staff activo/inactivo: con password + activated_at, sin token.
ALTER TABLE "usuarios" DROP CONSTRAINT IF EXISTS "usuarios_staff_activation_chk";
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_staff_activation_chk" CHECK (
  "role" = 'cliente'::role_enum
  OR (
    "password_hash" IS NULL
    AND "activated_at" IS NULL
    AND "activation_token_hash" IS NOT NULL
    AND "activation_expires_at" IS NOT NULL
    AND "is_active" = false
  )
  OR (
    "password_hash" IS NOT NULL
    AND "activated_at" IS NOT NULL
    AND "activation_token_hash" IS NULL
    AND "activation_expires_at" IS NULL
  )
);
