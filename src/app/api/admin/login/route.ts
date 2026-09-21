/* eslint-disable */
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { password } = await request.json();
    
    if (password === process.env.ADMIN_PASSWORD) {
      const response = NextResponse.json({ success: true });
      response.cookies.set('admin_session', 'authenticated', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60 * 24 // 1 day
      });
      return response;
    }
    
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  } catch (error) {
    return NextResponse.json({ error: 'Bad Request' }, { status: 400 });
  }
}
