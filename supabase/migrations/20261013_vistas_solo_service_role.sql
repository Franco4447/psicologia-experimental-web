-- ============================================================================
-- Migración 2026-10-13: las vistas con datos de participantes solo las lee el servidor
-- ============================================================================
-- Problema: v_admin_stats y v_experimental_dataset_long se creaban con los permisos de su
-- dueño (SECURITY DEFINER) y Supabase da SELECT a anon por defecto, así que cualquiera con
-- la clave pública podía leer todas las respuestas y datos demográficos, saltándose la RLS
-- de las tablas. v_dataset_participantes las heredaba al leer de v_experimental_dataset_long.
--
-- Arreglo: las vistas pasan a security_invoker y se revoca el acceso a anon y authenticated.
-- El servidor (service_role, que usa el panel admin y las exportaciones) conserva el acceso.
-- Se puede correr varias veces.

BEGIN;

ALTER VIEW public.v_admin_stats SET (security_invoker = true);
ALTER VIEW public.v_experimental_dataset_long SET (security_invoker = true);
ALTER VIEW public.v_dataset_participantes SET (security_invoker = true);

REVOKE ALL ON public.v_admin_stats, public.v_experimental_dataset_long, public.v_dataset_participantes FROM anon, authenticated;

GRANT SELECT ON public.v_admin_stats, public.v_experimental_dataset_long, public.v_dataset_participantes TO service_role;

COMMIT;
