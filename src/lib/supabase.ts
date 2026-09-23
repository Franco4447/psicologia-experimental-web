/**
 * Universidad Favaloro - Cátedra de Psicología Experimental
 * Parcial 2 - Investigación: Efecto de la Inducción Cognitiva sobre Falsos Recuerdos
 * 
 * Supabase Client Integration & Offline / Dev Mock Fallback
 * Target location: src/lib/supabase.ts
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { InductionGroup } from '@/types/experiment';

// ============================================================================
// 1. Database Schema Types (PostgreSQL Relational Contract)
// ============================================================================

export interface Database {
  public: {
    Tables: {
      participants: {
        Row: {
          id: string;
          created_at: string;
          completed_at: string | null;
          age: number;
          gender: string;
          studies_psychology: boolean;
          therapeutic_orientation: string;
          university: string;
          is_included: boolean;
          exclusion_reason: string | null;
          induction_group: string;
          fake_news_set: string;
          status: string;
          device_type: string | null;
          screen_resolution: string | null;
          user_agent: string | null;
          client_timestamp: string | null;
          mc_reported_induction: string | null;
          mc_emotion_usage: number | null;
          mc_reason_usage: number | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          completed_at?: string | null;
          age: number;
          gender: string;
          studies_psychology: boolean;
          therapeutic_orientation: string;
          university: string;
          is_included: boolean;
          exclusion_reason?: string | null;
          induction_group: string;
          fake_news_set: string;
          status?: string;
          device_type?: string | null;
          screen_resolution?: string | null;
          user_agent?: string | null;
          client_timestamp?: string | null;
          mc_reported_induction?: string | null;
          mc_emotion_usage?: number | null;
          mc_reason_usage?: number | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          completed_at?: string | null;
          age?: number;
          gender?: string;
          studies_psychology?: boolean;
          therapeutic_orientation?: string;
          university?: string;
          is_included?: boolean;
          exclusion_reason?: string | null;
          induction_group?: string;
          fake_news_set?: string;
          status?: string;
          device_type?: string | null;
          screen_resolution?: string | null;
          user_agent?: string | null;
          client_timestamp?: string | null;
          mc_reported_induction?: string | null;
          mc_emotion_usage?: number | null;
          mc_reason_usage?: number | null;
        };
        Relationships: [];
      };
      responses: {
        Row: {
          id: string;
          participant_id: string;
          presentation_order: number;
          news_id: number;
          news_title: string | null;
          is_fake: boolean;
          news_congruence: string;
          response_option: number;
          response_label: string;
          reading_time_ms: number;
          response_time_ms: number;
          is_false_memory: boolean;
          is_false_belief: boolean;
          is_true_memory: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          participant_id: string;
          presentation_order: number;
          news_id: number;
          news_title?: string | null;
          is_fake: boolean;
          news_congruence: string;
          response_option: number;
          response_label: string;
          reading_time_ms: number;
          response_time_ms: number;
          is_false_memory?: boolean;
          is_false_belief?: boolean;
          is_true_memory?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          participant_id?: string;
          presentation_order?: number;
          news_id?: number;
          news_title?: string | null;
          is_fake?: boolean;
          news_congruence?: string;
          response_option?: number;
          response_label?: string;
          reading_time_ms?: number;
          response_time_ms?: number;
          is_false_memory?: boolean;
          is_false_belief?: boolean;
          is_true_memory?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "responses_participant_id_fkey";
            columns: ["participant_id"];
            isOneToOne: false;
            referencedRelation: "participants";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      assign_induction_group: {
        Args: Record<string, never>;
        Returns: string;
      };
      cleanup_abandoned_sessions: {
        Args: Record<string, never>;
        Returns: undefined;
      };
      create_participant_session: {
        Args: {
          p_id?: string;
          p_age: number;
          p_gender: string;
          p_studies_psychology: boolean;
          p_therapeutic_orientation: string;
          p_university: string;
          p_is_included: boolean;
          p_exclusion_reason?: string | null;
          p_fake_news_set?: string | null;
          p_device_type?: string | null;
          p_screen_resolution?: string | null;
          p_user_agent?: string | null;
        };
        Returns: {
          participant_id: string;
          assigned_group: string;
          assigned_fake_set: string;
          status: string;
        }[];
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

export type ParticipantRow = Database['public']['Tables']['participants']['Row'];
export type ParticipantInsert = Database['public']['Tables']['participants']['Insert'];
export type ParticipantUpdate = Database['public']['Tables']['participants']['Update'];

export type ResponseRow = Database['public']['Tables']['responses']['Row'];
export type ResponseInsert = Database['public']['Tables']['responses']['Insert'];
export type ResponseUpdate = Database['public']['Tables']['responses']['Update'];

// ============================================================================
// 2. Environment Verification & Detection Helpers
// ============================================================================

const PLACEHOLDER_URL = 'https://your-project.supabase.co';
const PLACEHOLDER_ANON_KEY = 'your-anon-key';
const PLACEHOLDER_SERVICE_KEY = 'your-service-role-key';

/**
 * Checks if the Supabase environment is properly configured with live credentials.
 * Returns false when environment variables are missing, empty, or set to placeholder defaults.
 */
export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !anonKey) return false;
  if (url === PLACEHOLDER_URL || url.includes('your-project')) return false;
  if (anonKey === PLACEHOLDER_ANON_KEY || anonKey.length < 20) return false;

  return true;
}

/**
 * Checks if the Supabase Admin Service Role key is configured on the server.
 */
export function isSupabaseAdminConfigured(): boolean {
  if (!isSupabaseConfigured()) return false;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!serviceKey) return false;
  if (serviceKey === PLACEHOLDER_SERVICE_KEY || serviceKey.length < 20) return false;

  return true;
}

// ============================================================================
// 3. Client Singletons (Public Client & Server Admin Client)
// ============================================================================

let cachedPublicClient: SupabaseClient<Database> | null = null;
let cachedAdminClient: SupabaseClient<Database> | null = null;

/**
 * Returns the public Supabase client (using anon key).
 * Returns null if Supabase environment variables are not configured.
 */
export function getSupabaseClient(): SupabaseClient<Database> | null {
  if (!isSupabaseConfigured()) {
    return null;
  }

  if (!cachedPublicClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!.trim();
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim();

    cachedPublicClient = createClient<Database>(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return cachedPublicClient;
}

/**
 * Returns the server admin Supabase client (using service role key).
 * Falls back to public client if service role key is absent, or null if unconfigured.
 */
export function getSupabaseAdminClient(): SupabaseClient<Database> | null {
  if (!isSupabaseConfigured()) {
    return null;
  }

  if (isSupabaseAdminConfigured()) {
    if (!cachedAdminClient) {
      const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL)!.trim();
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!.trim();

      cachedAdminClient = createClient<Database>(url, serviceKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });
    }
    return cachedAdminClient;
  }

  // Fallback to anon client if admin key not set
  return getSupabaseClient();
}

/**
 * Named exports for direct usage when non-null is expected.
 */
export const supabase = getSupabaseClient();
export const supabaseAdmin = getSupabaseAdminClient();

// ============================================================================
// 4. In-Memory Mock Store (Offline & Local Dev Fallback Engine)
// ============================================================================

export interface MockStoreState {
  participants: Map<string, ParticipantRow>;
  responses: ResponseRow[];
  groupCounts: Record<InductionGroup, number>;
  excludedCount: number;
}

export class InMemoryMockStore {
  private participants: Map<string, ParticipantRow> = new Map();
  private responses: ResponseRow[] = [];
  private groupCounts: Record<InductionGroup, number> = {
    racional: 0,
    emocional: 0,
    control: 0,
  };
  private excludedCount = 0;

  /**
   * Balanced group allocation simulating the PostgreSQL RPC `assign_induction_group()`.
   * Guarantees max(N) - min(N) <= 1 under serial flow.
   */
  public assignGroup(isIncluded: boolean): InductionGroup {
    if (!isIncluded) {
      this.excludedCount++;
      return 'control';
    }

    const counts = this.groupCounts;
    const minCount = Math.min(counts.racional, counts.emocional, counts.control);
    const candidates = (['racional', 'emocional', 'control'] as InductionGroup[]).filter(
      (g) => counts[g] === minCount
    );

    const chosen = candidates[Math.floor(Math.random() * candidates.length)];
    counts[chosen]++;
    return chosen;
  }

  public createParticipant(input: ParticipantInsert): ParticipantRow {
    const id = input.id || crypto.randomUUID();
    const row: ParticipantRow = {
      id,
      created_at: input.created_at || new Date().toISOString(),
      completed_at: input.completed_at || null,
      age: input.age,
      gender: input.gender,
      studies_psychology: input.studies_psychology,
      therapeutic_orientation: input.therapeutic_orientation,
      university: input.university,
      is_included: input.is_included,
      exclusion_reason: input.exclusion_reason || null,
      induction_group: input.induction_group,
      fake_news_set: input.fake_news_set,
      status: input.status || 'started',
      device_type: input.device_type || null,
      screen_resolution: input.screen_resolution || null,
      user_agent: input.user_agent || null,
      client_timestamp: input.client_timestamp || null,
      mc_reported_induction: input.mc_reported_induction || null,
      mc_emotion_usage: input.mc_emotion_usage || null,
      mc_reason_usage: input.mc_reason_usage || null,
    };
    this.participants.set(id, row);
    return row;
  }

  public updateParticipant(id: string, update: ParticipantUpdate): ParticipantRow | null {
    const existing = this.participants.get(id);
    if (!existing) return null;

    const updated: ParticipantRow = {
      ...existing,
      ...update,
    };
    this.participants.set(id, updated);
    return updated;
  }

  public getParticipant(id: string): ParticipantRow | undefined {
    return this.participants.get(id);
  }

  public getAllParticipants(): ParticipantRow[] {
    return Array.from(this.participants.values());
  }

  public insertResponses(records: ResponseInsert[]): ResponseRow[] {
    const insertedRows: ResponseRow[] = records.map((r) => ({
      id: r.id || crypto.randomUUID(),
      participant_id: r.participant_id,
      presentation_order: r.presentation_order,
      news_id: r.news_id,
      news_title: r.news_title || null,
      is_fake: r.is_fake,
      news_congruence: r.news_congruence,
      response_option: r.response_option,
      response_label: r.response_label,
      reading_time_ms: r.reading_time_ms,
      response_time_ms: r.response_time_ms,
      is_false_memory: r.is_false_memory ?? (r.is_fake && r.response_option === 1),
      is_false_belief: r.is_false_belief ?? (r.is_fake && r.response_option === 2),
      is_true_memory: r.is_true_memory ?? (!r.is_fake && r.response_option === 1),
      created_at: r.created_at || new Date().toISOString(),
    }));

    // Deduplicate / Upsert on (participant_id, presentation_order)
    for (const row of insertedRows) {
      const existingIdx = this.responses.findIndex(
        (existing) =>
          existing.participant_id === row.participant_id &&
          existing.presentation_order === row.presentation_order
      );
      if (existingIdx >= 0) {
        this.responses[existingIdx] = row;
      } else {
        this.responses.push(row);
      }
    }

    return insertedRows;
  }

  public getResponses(participantId?: string): ResponseRow[] {
    if (!participantId) return [...this.responses];
    return this.responses.filter((r) => r.participant_id === participantId);
  }

  public getStats() {
    const all = this.getAllParticipants();
    const completed = all.filter((p) => p.status === 'completed');
    const included = all.filter((p) => p.is_included);
    const excluded = all.filter((p) => !p.is_included);

    return {
      total: all.length,
      completed: completed.length,
      included: included.length,
      excluded: excluded.length,
      counts: { ...this.groupCounts },
      totalResponses: this.responses.length,
    };
  }

  public reset(): void {
    this.participants.clear();
    this.responses = [];
    this.groupCounts = { racional: 0, emocional: 0, control: 0 };
    this.excludedCount = 0;
  }
}

// Global singleton for mock store (persists across hot reloads in dev)
declare global {
  // eslint-disable-next-line no-var
  var __favaloro_mock_store: InMemoryMockStore | undefined;
}

export const mockStore: InMemoryMockStore =
  globalThis.__favaloro_mock_store || new InMemoryMockStore();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__favaloro_mock_store = mockStore;
}
