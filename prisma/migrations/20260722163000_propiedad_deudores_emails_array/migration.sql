-- Normaliza deudores legacy { email } → { emails: [email] }
UPDATE "propiedades"
SET "deudores" = (
  SELECT COALESCE(
    jsonb_agg(
      CASE
        WHEN elem ? 'emails' THEN elem
        WHEN elem ? 'email' THEN (elem - 'email') || jsonb_build_object(
          'emails', jsonb_build_array(elem ->> 'email')
        )
        ELSE elem
      END
    ),
    '[]'::jsonb
  )
  FROM jsonb_array_elements("deudores") AS elem
)
WHERE jsonb_typeof("deudores") = 'array';
