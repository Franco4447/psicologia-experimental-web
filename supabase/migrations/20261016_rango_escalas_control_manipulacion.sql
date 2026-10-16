-- ============================================================================
-- Migración 2026-10-16: rango 1-5 en las escalas del control de manipulación
-- ============================================================================
-- schema.sql define estos CHECK desde el comienzo, pero la tabla de producción
-- se creó sin ellos. La pantalla de «Preguntas finales» solo permite valores del
-- 1 al 5; esto lo garantiza también en la base. Antes de aplicarla se verificó
-- que ningún valor guardado quedara fuera de rango. Aplicada en producción el
-- 2026-10-16.

ALTER TABLE public.participants ADD CONSTRAINT chk_participant_mc_emotion_usage
  CHECK (mc_emotion_usage IS NULL OR (mc_emotion_usage >= 1 AND mc_emotion_usage <= 5));
ALTER TABLE public.participants ADD CONSTRAINT chk_participant_mc_reason_usage
  CHECK (mc_reason_usage IS NULL OR (mc_reason_usage >= 1 AND mc_reason_usage <= 5));
