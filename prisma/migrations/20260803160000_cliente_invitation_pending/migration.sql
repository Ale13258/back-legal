-- Permitir usuarios role=cliente pendientes (invitación portal acreedor),
-- con el mismo patrón que staff: sin password, con token, is_active=false.

ALTER TABLE "usuarios" DROP CONSTRAINT IF EXISTS "usuarios_cliente_password_chk";

ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_cliente_password_chk" CHECK (
  "role" <> 'cliente'::role_enum
  OR (
    -- Activo / ya registrado
    "password_hash" IS NOT NULL
    AND "activated_at" IS NOT NULL
    AND "activation_token_hash" IS NULL
    AND "activation_expires_at" IS NULL
    AND "cliente_id" IS NOT NULL
  )
  OR (
    -- Pendiente de invitación (portal)
    "password_hash" IS NULL
    AND "activated_at" IS NULL
    AND "activation_token_hash" IS NOT NULL
    AND "activation_expires_at" IS NOT NULL
    AND "is_active" = false
    AND "cliente_id" IS NOT NULL
  )
);
