/* eslint-disable */
import { NextResponse } from 'next/server';
import { mockStore, supabaseAdmin } from '@/lib/supabase';
import { cookies } from 'next/headers';

export async function GET() {
  const cookieStore = cookies();
  const session = cookieStore.get('admin_session');
  
  if (session?.value !== 'authenticated') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (supabaseAdmin) {
    try {
      const { data, error } = await (supabaseAdmin as any).from('v_admin_stats').select('*').single();
      if (error) throw error;
      
      const stats = {
        totalParticipants: Number(data.total_participants),
        completedParticipants: Number(data.completed_participants),
        includedParticipants: Number(data.included_participants),
        excludedParticipants: Number(data.excluded_participants),
        completionRate: Number(data.completion_rate),
        groups: {
          racional: Number(data.group_racional),
          emocional: Number(data.group_emocional),
          control: Number(data.group_control)
        },
        orientations: { psicoanalisis: 0, evidencia: 0, otros: 0 },
        isBalanced: Boolean(data.is_balanced),
        maxDiscrepancy: Number(data.max_discrepancy)
      };
      return NextResponse.json(stats);
    } catch (error) {
      console.error('Error fetching stats from Supabase:', error);
    }
  }

  // Fallback to mock store
  const mockStats = mockStore.getStats();
  const allParts = mockStore.getAllParticipants();
  const counts = mockStats.counts;
  const maxGrp = Math.max(counts.racional, counts.emocional, counts.control);
  const minGrp = Math.min(counts.racional, counts.emocional, counts.control);
  
  const stats = {
    totalParticipants: mockStats.total,
    completedParticipants: mockStats.completed,
    includedParticipants: mockStats.included,
    excludedParticipants: mockStats.excluded,
    completionRate: mockStats.total > 0 ? (mockStats.completed / mockStats.total) * 100 : 0,
    groups: counts,
    orientations: {
      psicoanalisis: allParts.filter(p => p.therapeutic_orientation === 'Psicoanálisis').length,
      evidencia: allParts.filter(p => p.therapeutic_orientation === 'Basada en Evidencia Científica').length,
      otros: allParts.filter(p => p.therapeutic_orientation === 'Otros').length
    },
    isBalanced: (maxGrp - minGrp) <= 2,
    maxDiscrepancy: maxGrp - minGrp
  };

  return NextResponse.json(stats);
}
