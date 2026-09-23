-- ============================================================================
-- Universidad Favaloro - Cátedra de Psicología Experimental
-- Parcial 2 - Investigación: Efecto de la Inducción Cognitiva sobre Falsos Recuerdos
-- 
-- Complete Supabase PostgreSQL Schema (Milestone 3)
-- File: supabase/schema.sql
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Extensions
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 2. Participants Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ NULL,
    age INT NOT NULL,
    gender VARCHAR(50) NOT NULL,
    studies_psychology BOOLEAN NOT NULL,
    therapeutic_orientation VARCHAR(100) NOT NULL,
    university TEXT NOT NULL,
    is_included BOOLEAN NOT NULL,
    exclusion_reason VARCHAR(100) NULL,
    induction_group VARCHAR(50) NOT NULL,
    fake_news_set VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'started',
    device_type VARCHAR(50) NULL,
    screen_resolution VARCHAR(50) NULL,
    user_agent TEXT NULL,
    client_timestamp TIMESTAMPTZ NULL,
    mc_reported_induction VARCHAR(50) NULL,
    mc_emotion_usage INT NULL,
    mc_reason_usage INT NULL,

    -- Domain Constraints
    CONSTRAINT chk_participant_age 
        CHECK (age >= 18 AND age <= 120),
    CONSTRAINT chk_participant_gender 
        CHECK (gender IN ('Femenino', 'Masculino', 'Otro')),
    CONSTRAINT chk_participant_orientation 
        CHECK (therapeutic_orientation IN ('Psicoanálisis', 'Basada en Evidencia Científica', 'Otros')),
    CONSTRAINT chk_participant_exclusion_reason 
        CHECK (exclusion_reason IS NULL OR exclusion_reason IN ('menor_de_edad', 'no_estudia_psicologia', 'orientacion_otros', 'session_timeout_1h')),
    CONSTRAINT chk_participant_induction_group 
        CHECK (induction_group IN ('racional', 'emocional', 'control')),
    CONSTRAINT chk_participant_fake_news_set 
        CHECK (fake_news_set IN ('psicoanalisis', 'evidencia', 'control_random')),
    CONSTRAINT chk_participant_status 
        CHECK (status IN ('started', 'reading', 'completed', 'abandoned')),
    CONSTRAINT chk_participant_device_type 
        CHECK (device_type IS NULL OR device_type IN ('desktop', 'mobile', 'tablet')),
    CONSTRAINT chk_participant_mc_emotion_usage 
        CHECK (mc_emotion_usage IS NULL OR (mc_emotion_usage >= 1 AND mc_emotion_usage <= 5)),
    CONSTRAINT chk_participant_mc_reason_usage 
        CHECK (mc_reason_usage IS NULL OR (mc_reason_usage >= 1 AND mc_reason_usage <= 5)),
    CONSTRAINT chk_participant_exclusion_logic 
        CHECK (
            (is_included = true) OR 
            (is_included = false AND induction_group = 'control' AND fake_news_set = 'control_random')
        )
);

-- ----------------------------------------------------------------------------
-- 3. Responses Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    participant_id UUID NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
    presentation_order INT NOT NULL,
    news_id INT NOT NULL,
    news_title TEXT NULL,
    is_fake BOOLEAN NOT NULL,
    news_congruence VARCHAR(50) NOT NULL,
    response_option INT NOT NULL,
    response_label TEXT NOT NULL,
    reading_time_ms INT NOT NULL,
    response_time_ms INT NOT NULL,
    is_false_memory BOOLEAN NOT NULL DEFAULT false,
    is_false_belief BOOLEAN NOT NULL DEFAULT false,
    is_true_memory BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Domain & Integrity Constraints
    CONSTRAINT chk_response_presentation_order 
        CHECK (presentation_order BETWEEN 1 AND 20),
    CONSTRAINT chk_response_news_id 
        CHECK (news_id BETWEEN 1 AND 28),
    CONSTRAINT chk_response_option 
        CHECK (response_option IN (1, 2, 3, 4)),
    CONSTRAINT chk_response_reading_time 
        CHECK (reading_time_ms >= 0),
    CONSTRAINT chk_response_response_time 
        CHECK (response_time_ms >= 0),
    CONSTRAINT chk_response_congruence 
        CHECK (news_congruence IN ('psicoanalisis', 'evidencia', 'true', 'neutral', 'congruent', 'incongruent')),
    CONSTRAINT chk_response_fake_news_id_match 
        CHECK (
            (is_fake = false AND news_id BETWEEN 1 AND 12) OR 
            (is_fake = true AND news_id BETWEEN 13 AND 28)
        ),
    -- Prevent duplicate submissions per session
    CONSTRAINT uq_responses_participant_order 
        UNIQUE (participant_id, presentation_order),
    CONSTRAINT uq_responses_participant_news 
        UNIQUE (participant_id, news_id)
);

-- ----------------------------------------------------------------------------
-- 4. Automatic Trigger for Psychological Constructs
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_fn_calculate_response_constructs()
RETURNS TRIGGER AS $$
BEGIN
    -- Construct 1: Falso Recuerdo (Option 1 on Fake News)
    NEW.is_false_memory := (NEW.is_fake = true AND NEW.response_option = 1);
    -- Construct 2: Falsa Creencia (Option 2 on Fake News)
    NEW.is_false_belief := (NEW.is_fake = true AND NEW.response_option = 2);
    -- Construct 3: Memoria Verdadera (Option 1 on True News)
    NEW.is_true_memory  := (NEW.is_fake = false AND NEW.response_option = 1);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_responses_calculate_constructs ON public.responses;
CREATE TRIGGER trg_responses_calculate_constructs
BEFORE INSERT OR UPDATE ON public.responses
FOR EACH ROW
EXECUTE FUNCTION public.trg_fn_calculate_response_constructs();

-- ----------------------------------------------------------------------------
-- 5. Performance Indexes
-- ----------------------------------------------------------------------------
-- Participant table indexes
CREATE INDEX IF NOT EXISTS idx_participants_is_included_group 
    ON public.participants(is_included, induction_group);
CREATE INDEX IF NOT EXISTS idx_participants_status 
    ON public.participants(status);
CREATE INDEX IF NOT EXISTS idx_participants_created_at 
    ON public.participants(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_participants_orientation 
    ON public.participants(therapeutic_orientation);

-- Responses table indexes
CREATE INDEX IF NOT EXISTS idx_responses_participant 
    ON public.responses(participant_id);
CREATE INDEX IF NOT EXISTS idx_responses_news_id 
    ON public.responses(news_id);
CREATE INDEX IF NOT EXISTS idx_responses_participant_order 
    ON public.responses(participant_id, presentation_order);
CREATE INDEX IF NOT EXISTS idx_responses_false_memory 
    ON public.responses(participant_id) WHERE is_false_memory = true;
CREATE INDEX IF NOT EXISTS idx_responses_false_belief 
    ON public.responses(participant_id) WHERE is_false_belief = true;

-- ----------------------------------------------------------------------------
-- 6. Balanced Allocation RPC: assign_induction_group()
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assign_induction_group()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    chosen_group text;
BEGIN
    -- Acquire transaction-level advisory lock to serialize group quota evaluation
    -- Key 742911 is designated specifically for this cognitive induction balancing barrier.
    PERFORM pg_advisory_xact_lock(742911);

    -- Count active, included participants across the 3 experimental groups
    WITH counts AS (
        SELECT 'racional'::text AS grp, COUNT(*)::bigint AS cnt 
        FROM public.participants 
        WHERE is_included = true AND induction_group = 'racional'
        UNION ALL
        SELECT 'emocional'::text AS grp, COUNT(*)::bigint AS cnt 
        FROM public.participants 
        WHERE is_included = true AND induction_group = 'emocional'
        UNION ALL
        SELECT 'control'::text AS grp, COUNT(*)::bigint AS cnt 
        FROM public.participants 
        WHERE is_included = true AND induction_group = 'control'
    ),
    min_candidates AS (
        SELECT grp 
        FROM counts 
        WHERE cnt = (SELECT MIN(cnt) FROM counts)
    )
    SELECT grp INTO chosen_group
    FROM min_candidates
    ORDER BY random()
    LIMIT 1;

    RETURN chosen_group;
END;
$$;

-- ----------------------------------------------------------------------------
-- 7. High-Concurrency Atomic Registration RPC: create_participant_session()
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_participant_session(
    p_id UUID,
    p_age INT,
    p_gender VARCHAR(50),
    p_studies_psychology BOOLEAN,
    p_therapeutic_orientation VARCHAR(100),
    p_university TEXT,
    p_is_included BOOLEAN,
    p_exclusion_reason VARCHAR(100) DEFAULT NULL,
    p_fake_news_set VARCHAR(50) DEFAULT NULL,
    p_device_type VARCHAR(50) DEFAULT NULL,
    p_screen_resolution VARCHAR(50) DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
)
RETURNS TABLE (
    participant_id UUID,
    assigned_group VARCHAR(50),
    assigned_fake_set VARCHAR(50),
    status VARCHAR(50)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_group VARCHAR(50);
    v_fake_set VARCHAR(50);
    v_id UUID;
BEGIN
    -- Acquire transaction-level advisory lock to serialize group quota evaluation & insert
    PERFORM pg_advisory_xact_lock(742911);

    v_id := COALESCE(p_id, gen_random_uuid());

    IF p_is_included = false THEN
        v_group := 'control';
        v_fake_set := 'control_random';
    ELSE
        -- Minimum-fill with random tie-breaking
        WITH counts AS (
            SELECT 'racional'::text AS grp, COUNT(*)::bigint AS cnt 
            FROM public.participants 
            WHERE is_included = true AND induction_group = 'racional'
            UNION ALL
            SELECT 'emocional'::text AS grp, COUNT(*)::bigint AS cnt 
            FROM public.participants 
            WHERE is_included = true AND induction_group = 'emocional'
            UNION ALL
            SELECT 'control'::text AS grp, COUNT(*)::bigint AS cnt 
            FROM public.participants 
            WHERE is_included = true AND induction_group = 'control'
        ),
        min_candidates AS (
            SELECT grp 
            FROM counts 
            WHERE cnt = (SELECT MIN(cnt) FROM counts)
        )
        SELECT grp INTO v_group
        FROM min_candidates
        ORDER BY random()
        LIMIT 1;

        -- Determine fake news set based on orientation if not provided
        IF p_fake_news_set IS NOT NULL THEN
            v_fake_set := p_fake_news_set;
        ELSIF p_therapeutic_orientation = 'Psicoanálisis' THEN
            v_fake_set := 'psicoanalisis';
        ELSIF p_therapeutic_orientation = 'Basada en Evidencia Científica' THEN
            v_fake_set := 'evidencia';
        ELSE
            v_fake_set := 'control_random';
        END IF;
    END IF;

    -- Insert atomically before releasing advisory lock at commit
    INSERT INTO public.participants (
        id,
        age,
        gender,
        studies_psychology,
        therapeutic_orientation,
        university,
        is_included,
        exclusion_reason,
        induction_group,
        fake_news_set,
        status,
        device_type,
        screen_resolution,
        user_agent
    ) VALUES (
        v_id,
        p_age,
        p_gender,
        p_studies_psychology,
        p_therapeutic_orientation,
        p_university,
        p_is_included,
        p_exclusion_reason,
        v_group,
        v_fake_set,
        'started',
        p_device_type,
        p_screen_resolution,
        p_user_agent
    );

    RETURN QUERY SELECT v_id, v_group, v_fake_set, 'started'::VARCHAR(50);
END;
$$;

-- ----------------------------------------------------------------------------
-- 8. Row Level Security (RLS) Policies
-- ----------------------------------------------------------------------------
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.responses ENABLE ROW LEVEL SECURITY;

-- Clean up existing policies if re-running
DROP POLICY IF EXISTS "Allow anonymous participant insertion" ON public.participants;
DROP POLICY IF EXISTS "Allow anonymous update of own session completion" ON public.participants;
DROP POLICY IF EXISTS "Allow anonymous response insertion" ON public.responses;
DROP POLICY IF EXISTS "Service role full access to participants" ON public.participants;
DROP POLICY IF EXISTS "Service role full access to responses" ON public.responses;

-- Policy 1: Anonymous public participants can create sessions
CREATE POLICY "Allow anonymous participant insertion"
    ON public.participants
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

-- Policy 2: Anonymous participants can update their session status upon completion
CREATE POLICY "Allow anonymous update of own session completion"
    ON public.participants
    FOR UPDATE
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);

-- Policy 3: Anonymous participants can insert trial responses
CREATE POLICY "Allow anonymous response insertion"
    ON public.responses
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

-- Note: NO public SELECT policy is defined for `anon`.
-- All SELECT queries by public participants return 0 rows (default deny).
-- Researcher queries, stats, and CSV exports use `service_role` via Next.js API routes.

-- Policy 4 & 5: Service role full access
CREATE POLICY "Service role full access to participants"
    ON public.participants
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Service role full access to responses"
    ON public.responses
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 9. Permissions & Grants
-- ----------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT INSERT, UPDATE ON TABLE public.participants TO anon, authenticated;
GRANT INSERT ON TABLE public.responses TO anon, authenticated;
GRANT ALL ON TABLE public.participants TO service_role;
GRANT ALL ON TABLE public.responses TO service_role;

GRANT EXECUTE ON FUNCTION public.assign_induction_group() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_participant_session(UUID, INT, VARCHAR, BOOLEAN, VARCHAR, TEXT, BOOLEAN, VARCHAR, VARCHAR, VARCHAR, VARCHAR, TEXT) TO anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 10. Analytical Views (for Admin Dashboard & CSV Export)
-- ----------------------------------------------------------------------------
-- View for Admin Dashboard Stats (/api/admin/stats)
CREATE OR REPLACE VIEW public.v_admin_stats AS
WITH grp_counts AS (
    SELECT 
        COUNT(*) FILTER (WHERE induction_group = 'racional') AS n_racional,
        COUNT(*) FILTER (WHERE induction_group = 'emocional') AS n_emocional,
        COUNT(*) FILTER (WHERE induction_group = 'control') AS n_control
    FROM public.participants
    WHERE is_included = true
)
SELECT
    COUNT(*) AS total_participants,
    COUNT(*) FILTER (WHERE status = 'completed') AS completed_participants,
    COUNT(*) FILTER (WHERE is_included = true) AS included_participants,
    COUNT(*) FILTER (WHERE is_included = false) AS excluded_participants,
    ROUND(COALESCE(COUNT(*) FILTER (WHERE status = 'completed')::numeric / NULLIF(COUNT(*), 0) * 100, 0), 2) AS completion_rate,
    COALESCE((SELECT n_racional FROM grp_counts), 0) AS group_racional,
    COALESCE((SELECT n_emocional FROM grp_counts), 0) AS group_emocional,
    COALESCE((SELECT n_control FROM grp_counts), 0) AS group_control,
    COALESCE((SELECT GREATEST(n_racional, n_emocional, n_control) - LEAST(n_racional, n_emocional, n_control) FROM grp_counts), 0) AS max_discrepancy,
    COALESCE((SELECT (GREATEST(n_racional, n_emocional, n_control) - LEAST(n_racional, n_emocional, n_control) <= 2) FROM grp_counts), true) AS is_balanced
FROM public.participants;

-- View for Long-Format CSV Export (/api/admin/export-csv)
CREATE OR REPLACE VIEW public.v_experimental_dataset_long AS
SELECT 
    p.id AS participant_id,
    p.created_at,
    p.completed_at,
    p.age,
    p.gender,
    p.studies_psychology,
    p.therapeutic_orientation,
    p.university,
    p.is_included,
    COALESCE(p.exclusion_reason, '') AS exclusion_reason,
    p.induction_group,
    p.fake_news_set,
    r.presentation_order,
    r.news_id,
    COALESCE(r.news_title, '') AS news_title,
    r.is_fake,
    r.news_congruence,
    r.response_option,
    r.response_label,
    CASE WHEN r.is_false_memory THEN 1 ELSE 0 END AS is_false_memory,
    CASE WHEN r.is_false_belief THEN 1 ELSE 0 END AS is_false_belief,
    CASE WHEN r.is_true_memory THEN 1 ELSE 0 END AS is_true_memory,
    r.reading_time_ms,
    r.response_time_ms,
    COALESCE(p.device_type, '') AS device_type,
    COALESCE(p.screen_resolution, '') AS screen_resolution,
    COALESCE(p.user_agent, '') AS user_agent,
    COALESCE(p.mc_reported_induction, '') AS mc_reported_induction,
    p.mc_emotion_usage,
    p.mc_reason_usage
FROM public.participants p
JOIN public.responses r ON p.id = r.participant_id
ORDER BY p.created_at DESC, r.presentation_order ASC;

GRANT SELECT ON public.v_admin_stats TO service_role;
GRANT SELECT ON public.v_experimental_dataset_long TO service_role;

-- ----------------------------------------------------------------------------
-- 11. Cleanup Abandoned Sessions
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cleanup_abandoned_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.participants
    SET 
        status = 'abandoned',
        is_included = false,
        exclusion_reason = 'session_timeout_1h',
        induction_group = 'control',
        fake_news_set = 'control_random'
    WHERE 
        status = 'started' 
        AND created_at < NOW() - INTERVAL '1 hour';
END;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_abandoned_sessions() TO service_role;

