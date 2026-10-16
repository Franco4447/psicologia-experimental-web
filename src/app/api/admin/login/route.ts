/* eslint-disable */
import { NextResponse } from 'next/server';
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE_SECONDS,
  createAdminSessionToken,
  isAdminPasswordValid,
} from '@/lib/adminAuth';

export async function POST(request: Request) {
  try {
    const { password } = await request.json();

    const token = isAdminPasswordValid(password) ? createAdminSessionToken() : null;
    if (token) {
      const response = NextResponse.json({ success: true });
      response.cookies.set(ADMIN_SESSION_COOKIE, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
      });
      return response;
    }

    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  } catch (error) {
    return NextResponse.json({ error: 'Bad Request' }, { status: 400 });
  }
}
