/* eslint-disable */
import { NextResponse } from 'next/server';
import { mockStore, supabaseAdmin } from '@/lib/supabase';
import { isAdminRequest } from '@/lib/adminAuth';
import { exportFileDate, fetchAllRows } from '@/lib/adminStats';

export const dynamic = 'force-dynamic';

function escapeCsv(value: any) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function jsonToCsv(items: any[]) {
  if (items.length === 0) return '';
  const header = Object.keys(items[0]);
  const csv = [
    header.join(','),
    ...items.map(row => header.map(fieldName => escapeCsv(row[fieldName])).join(','))
  ].join('\r\n');
  return '﻿' + csv; // UTF-8 BOM
}

function mockDataset() {
  const participants = mockStore.getAllParticipants();
  const responses = mockStore.getResponses();

  const data: any[] = [];
  for (const p of participants) {
    const pResponses = responses.filter(r => r.participant_id === p.id);
    for (const r of pResponses) {
      data.push({
        participant_id: p.id,
        created_at: p.created_at,
        completed_at: p.completed_at,
        age: p.age,
        gender: p.gender,
        studies_psychology: p.studies_psychology,
        therapeutic_orientation: p.therapeutic_orientation,
        university: p.university,
        is_included: p.is_included,
        exclusion_reason: p.exclusion_reason,
        induction_group: p.induction_group,
        fake_news_set: p.fake_news_set,
        presentation_order: r.presentation_order,
        news_id: r.news_id,
        news_title: r.news_title,
        is_fake: r.is_fake,
        news_congruence: r.news_congruence,
        response_option: r.response_option,
        response_label: r.response_label,
        is_false_memory: r.is_false_memory ? 1 : 0,
        is_false_belief: r.is_false_belief ? 1 : 0,
        is_true_memory: r.is_true_memory ? 1 : 0,
        reading_time_ms: r.reading_time_ms,
        response_time_ms: r.response_time_ms,
        device_type: p.device_type,
        screen_resolution: p.screen_resolution,
        user_agent: p.user_agent,
        mc_reported_induction: p.mc_reported_induction,
        mc_emotion_usage: p.mc_emotion_usage,
        mc_reason_usage: p.mc_reason_usage,
        residence: p.residence
      });
    }
  }
  return data;
}

export async function GET() {
  if (!isAdminRequest()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let data: any[];

  // The in-memory store is only for local development without Supabase.
  if (!supabaseAdmin) {
    data = mockDataset();
  } else {
    try {
      const db = supabaseAdmin as any;
      // Same order as the view (newest participant first), plus the participant id
      // as a tie-breaker so the pages do not overlap.
      data = await fetchAllRows((from, to) =>
        db
          .from('v_experimental_dataset_long')
          .select('*')
          .order('created_at', { ascending: false })
          .order('participant_id', { ascending: true })
          .order('presentation_order', { ascending: true })
          .range(from, to)
      );
    } catch (error) {
      console.error('Error fetching export from Supabase:', error);
      return NextResponse.json(
        { error: 'No se pudo leer la vista v_experimental_dataset_long.' },
        { status: 500 }
      );
    }
  }

  const csv = jsonToCsv(data);

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="respuestas_${exportFileDate()}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
