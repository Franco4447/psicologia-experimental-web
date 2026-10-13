-- ============================================================================
-- Migración 2026-10-13: assign_induction_group() solo para el servidor
-- ============================================================================
-- La llama /api/session con el cliente admin (service_role). Se verificó con una prueba
-- real: tras crear un participante incluido el contador de llamadas de la función subió en uno,
-- y el grupo asignado coincidió con el de menor tamaño. La misma petición inserta el participante
-- con service_role, y el código usa un único cliente para ambas operaciones.
-- Se revoca EXECUTE a PUBLIC, anon y authenticated (aviso anon_security_definer_function_executable).
-- Se puede correr varias veces.

BEGIN;

REVOKE EXECUTE ON FUNCTION public.assign_induction_group() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assign_induction_group() TO service_role;

COMMIT;
