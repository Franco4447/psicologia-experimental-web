/* eslint-disable */
import { NextResponse } from 'next/server';
import { mockStore, supabaseAdmin } from '@/lib/supabase';
import { cookies } from 'next/headers';

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
  return '\uFEFF' + csv; // UTF-8 BOM
}

export async function GET() {
  const cookieStore = cookies();
  const session = cookieStore.get('admin_session');
  
  if (session?.value !== 'authenticated') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let data: any[] = [];

  if (supabaseAdmin) {
    try {
      const { data: dbData, error } = await (supabaseAdmin as any).from('v_experimental_dataset_long').select('*');
      if (error) throw error;
      data = dbData || [];
    } catch (error) {
      console.error('Error fetching export from Supabase:', error);
    }
  }

  if (data.length === 0) {
    // Fallback to mock store
    const participants = mockStore.getAllParticipants();
    const responses = mockStore.getResponses();
    
    data = [];
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
          user_agent: p.user_agent
        });
      }
    }
  }

  const csv = jsonToCsv(data);

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="experiment_data.csv"',
    },
  });
}
