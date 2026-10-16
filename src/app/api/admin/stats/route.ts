/* eslint-disable */
import { NextResponse } from 'next/server';
import { mockStore, supabaseAdmin } from '@/lib/supabase';
import { isAdminRequest } from '@/lib/adminAuth';
import { buildAdminStats, fetchAllRows } from '@/lib/adminStats';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!isAdminRequest()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let participants: any[];
  let responses: any[];

  // The in-memory store is only for local development without Supabase. With
  // Supabase configured, a failed read is reported instead of showing empty data.
  if (!supabaseAdmin) {
    participants = mockStore.getAllParticipants();
    responses = mockStore.getResponses();
  } else {
    try {
      const db = supabaseAdmin as any;
      [participants, responses] = await Promise.all([
        fetchAllRows((from, to) =>
          db.from('participants').select('*').order('id', { ascending: true }).range(from, to)
        ),
        fetchAllRows((from, to) =>
          db.from('responses').select('*').order('id', { ascending: true }).range(from, to)
        ),
      ]);
    } catch (error) {
      console.error('Error fetching data from Supabase:', error);
      return NextResponse.json(
        { error: 'No se pudieron leer los datos de Supabase.' },
        { status: 500, headers: { 'Cache-Control': 'no-store' } }
      );
    }
  }

  return NextResponse.json(buildAdminStats(participants, responses), {
    headers: { 'Cache-Control': 'no-store' },
  });
}
