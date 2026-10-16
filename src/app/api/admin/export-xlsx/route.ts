/* eslint-disable */
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isAdminRequest } from '@/lib/adminAuth';
import { exportFileDate, fetchAllRows } from '@/lib/adminStats';
import { buildParticipantsXlsx } from '@/lib/participantsXlsx';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Vista con una fila por participante (ver supabase/schema.sql, sección 10).
const VIEW_NAME = process.env.PARTICIPANTS_VIEW_NAME || 'v_dataset_participantes';

export async function GET() {
  if (!isAdminRequest()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: 'Supabase no está configurado: no se puede leer la vista de participantes.' },
      { status: 503 }
    );
  }

  let rows: Record<string, unknown>[];
  try {
    const db = supabaseAdmin as any;
    rows = await fetchAllRows((from, to) =>
      db.from(VIEW_NAME).select('*').order('id_participante', { ascending: true }).range(from, to)
    );
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
      'Content-Disposition': `attachment; filename="participantes_${exportFileDate()}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  });
}
