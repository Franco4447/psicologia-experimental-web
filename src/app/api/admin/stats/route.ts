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

  let allParts: any[] = [];
  let allResp: any[] = [];

  if (supabaseAdmin) {
    try {
      const [{ data: pData, error: pErr }, { data: rData, error: rErr }] = await Promise.all([
        (supabaseAdmin as any).from('participants').select('*'),
        (supabaseAdmin as any).from('responses').select('*')
      ]);
      if (pErr) throw pErr;
      if (rErr) throw rErr;
      allParts = pData || [];
      allResp = rData || [];
    } catch (error) {
      console.error('Error fetching data from Supabase:', error);
    }
  }

  if (allParts.length === 0) {
    allParts = mockStore.getAllParticipants();
    allResp = mockStore.getResponses();
  }

  const stats = {
    totalParticipants: allParts.length,
    completedParticipants: allParts.filter(p => p.status === 'completed').length,
    includedParticipants: allParts.filter(p => p.is_included).length,
    excludedParticipants: allParts.filter(p => !p.is_included).length,
    completionRate: allParts.length > 0 ? (allParts.filter(p => p.status === 'completed').length / allParts.length) * 100 : 0,
    groups: {
      racional: allParts.filter(p => p.is_included && p.induction_group === 'racional').length,
      emocional: allParts.filter(p => p.is_included && p.induction_group === 'emocional').length,
      control: allParts.filter(p => p.is_included && p.induction_group === 'control').length
    },
    orientations: {
      psicoanalisis: allParts.filter(p => p.therapeutic_orientation === 'Psicoanálisis').length,
      evidencia: allParts.filter(p => p.therapeutic_orientation === 'Basada en Evidencia Científica').length,
      otros: allParts.filter(p => p.therapeutic_orientation === 'Otros').length
    },
    isBalanced: false,
    maxDiscrepancy: 0,
    participantsList: [] as any[],
    exclusionBreakdown: {} as Record<string, number>,
    kpis: {
      overall: { falseMemoryRate: 0, falseBeliefRate: 0, trueMemoryRate: 0, avgReadingTimeMs: 0, avgResponseTimeMs: 0 },
      byGroup: {} as Record<string, any>
    },
    manipulationCheck: {
      reportedInduction: {} as Record<string, number>,
      scoresByGroup: {} as Record<string, any>
    },
    demographics: {
      age: { mean: 0, sd: 0, min: 0, max: 0 },
      gender: {} as Record<string, number>
    }
  };

  const groups = stats.groups;
  const maxGrp = Math.max(groups.racional, groups.emocional, groups.control);
  const minGrp = Math.min(groups.racional, groups.emocional, groups.control);
  stats.maxDiscrepancy = maxGrp - minGrp;
  stats.isBalanced = stats.maxDiscrepancy <= 2;

  // participantsList
  stats.participantsList = allParts.map(p => ({
    id: String(p.id).substring(0, 8),
    age: p.age,
    gender: p.gender,
    university: p.university,
    therapeuticOrientation: p.therapeutic_orientation,
    inductionGroup: p.induction_group,
    status: p.status,
    isIncluded: p.is_included,
    exclusionReason: p.exclusion_reason || null,
    completedAt: p.completed_at || null
  }));

  // exclusionBreakdown
  allParts.forEach(p => {
    if (!p.is_included && p.exclusion_reason) {
      stats.exclusionBreakdown[p.exclusion_reason] = (stats.exclusionBreakdown[p.exclusion_reason] || 0) + 1;
    }
  });

  // demographics
  const ages = allParts.map(p => p.age).filter(a => typeof a === 'number');
  if (ages.length > 0) {
    const mean = ages.reduce((a, b) => a + b, 0) / ages.length;
    const sqDiff = ages.map(a => Math.pow(a - mean, 2));
    const sd = Math.sqrt(sqDiff.reduce((a, b) => a + b, 0) / ages.length);
    stats.demographics.age = {
      mean,
      sd,
      min: Math.min(...ages),
      max: Math.max(...ages)
    };
  }
  allParts.forEach(p => {
    if (p.gender) {
      stats.demographics.gender[p.gender] = (stats.demographics.gender[p.gender] || 0) + 1;
    }
  });

  // Manipulation Check
  allParts.forEach(p => {
    if (p.is_included && p.mc_reported_induction) {
      stats.manipulationCheck.reportedInduction[p.mc_reported_induction] = (stats.manipulationCheck.reportedInduction[p.mc_reported_induction] || 0) + 1;
    }
  });

  ['racional', 'emocional', 'control'].forEach(grp => {
    const pGroup = allParts.filter(p => p.is_included && p.induction_group === grp && typeof p.mc_emotion_usage === 'number' && typeof p.mc_reason_usage === 'number');
    let avgEmotion = 0;
    let avgReason = 0;
    if (pGroup.length > 0) {
      avgEmotion = pGroup.reduce((sum, p) => sum + (p.mc_emotion_usage || 0), 0) / pGroup.length;
      avgReason = pGroup.reduce((sum, p) => sum + (p.mc_reason_usage || 0), 0) / pGroup.length;
    }
    stats.manipulationCheck.scoresByGroup[grp] = { avgEmotionUsage: avgEmotion, avgReasonUsage: avgReason };
  });

  // KPIs
  const includedCompletedParts = allParts.filter(p => p.is_included && p.status === 'completed');
  const icIds = new Set(includedCompletedParts.map(p => p.id));
  const validResp = allResp.filter(r => icIds.has(r.participant_id));

  const calcKpis = (respList: any[]) => {
    if (respList.length === 0) return { falseMemoryRate: 0, falseBeliefRate: 0, trueMemoryRate: 0, avgReadingTimeMs: 0, avgResponseTimeMs: 0 };
    
    const fakeResp = respList.filter(r => r.is_fake);
    const trueResp = respList.filter(r => !r.is_fake);
    
    let falseMemoryRate = 0, falseBeliefRate = 0, trueMemoryRate = 0;
    if (fakeResp.length > 0) {
      falseMemoryRate = (fakeResp.filter(r => r.is_false_memory).length / fakeResp.length) * 100;
      falseBeliefRate = (fakeResp.filter(r => r.is_false_belief).length / fakeResp.length) * 100;
    }
    if (trueResp.length > 0) {
      trueMemoryRate = (trueResp.filter(r => r.is_true_memory).length / trueResp.length) * 100;
    }

    const avgReadingTimeMs = respList.reduce((sum, r) => sum + (r.reading_time_ms || 0), 0) / respList.length;
    const avgResponseTimeMs = respList.reduce((sum, r) => sum + (r.response_time_ms || 0), 0) / respList.length;

    return { falseMemoryRate, falseBeliefRate, trueMemoryRate, avgReadingTimeMs, avgResponseTimeMs };
  };

  stats.kpis.overall = calcKpis(validResp);

  ['racional', 'emocional', 'control'].forEach(grp => {
    const grpIds = new Set(includedCompletedParts.filter(p => p.induction_group === grp).map(p => p.id));
    const grpResp = validResp.filter(r => grpIds.has(r.participant_id));
    stats.kpis.byGroup[grp] = calcKpis(grpResp);
  });

  return NextResponse.json(stats);
}
