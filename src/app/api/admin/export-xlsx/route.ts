/* eslint-disable */
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase';
import { buildParticipantsXlsx } from '@/lib/participantsXlsx';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Vista con una fila por participante (ver supabase/schema.sql, sección 10).
const VIEW_NAME = process.env.PARTICIPANTS_VIEW_NAME || 'v_dataset_participantes';
const PAGE_SIZE = 1000; // Límite por defecto de PostgREST por consulta.

export async function GET() {
  const session = cookies().get('admin_session');
  if (session?.value !== 'authenticated') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: 'Supabase no está configurado: no se puede leer la vista de participantes.' },
      { status: 503 }
    );
  }

  const rows: Record<string, unknown>[] = [];
  try {
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await (supabaseAdmin as any)
        .from(VIEW_NAME)
        .select('*')
        .order('id_participante', { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw error;
      rows.push(...(data || []));
      if (!data || data.length < PAGE_SIZE) break;
    }
  } catch (error) {
    console.error(`Error fetching ${VIEW_NAME} from Supabase:`, error);
    return NextResponse.json(
      { error: `No se pudo leer la vista ${VIEW_NAME}.` },
      { status: 500 }
    );
  }

  const xlsx = await buildParticipantsXlsx(rows);

  return new NextResponse(new Uint8Array(xlsx), {
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="participantes.xlsx"',
      'Cache-Control': 'no-store',
    },
  });
}
