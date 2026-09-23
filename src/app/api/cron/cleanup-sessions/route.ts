import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    // Optionally verify cron token here, if configured in Vercel.
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const client = getSupabaseAdminClient();
    
    if (!client) {
      return NextResponse.json({ success: false, error: 'Supabase client not configured' }, { status: 500 });
    }

    // Call the cleanup_abandoned_sessions RPC function that we defined in schema.sql
    const { error } = await client.rpc('cleanup_abandoned_sessions');

    if (error) {
      console.error('[Cron] Cleanup error:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    console.log('[Cron] Successfully ran cleanup_abandoned_sessions');
    return NextResponse.json({ success: true, message: 'Cleanup complete' });

  } catch (error: unknown) {
    console.error('[Cron] Exception:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
