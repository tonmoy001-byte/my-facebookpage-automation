// @ts-nocheck
import { NextResponse } from 'next/server';
import { getCurrentUser, hashPassword, verifyPassword } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, markAuthFailed, resetBackoff } from '@/lib/rate-limit';
import { rateLimitConfig } from '@/lib/rate-limit-config';

export async function PUT(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }, { status: 401 });
    }

    const key = `password:${user.id}`;
    const rl = checkRateLimit(key, rateLimitConfig.auth_sensitive);
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: { code: 'RATE_LIMITED', message: `Too many attempts. Try again in ${Math.ceil((rl.retryAfterMs || 60000) / 1000)} seconds.` } },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.retryAfterMs || 60000) / 1000)) } }
      );
    }

    const { currentPassword, newPassword } = await request.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Current and new passwords are required' } },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'New password must be at least 8 characters' } },
        { status: 400 }
      );
    }

    const userWithPassword = await prisma.user.findUnique({
      where: { id: user.id },
      select: { passwordHash: true },
    });

    if (!userWithPassword) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } }, { status: 404 });
    }

    const isValid = await verifyPassword(currentPassword, userWithPassword.passwordHash);
    if (!isValid) {
      markAuthFailed(key, rateLimitConfig.auth_sensitive);
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_PASSWORD', message: 'Current password is incorrect' } },
        { status: 400 }
      );
    }

    const newHash = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash },
    });

    resetBackoff(key);
    return NextResponse.json({ success: true, data: { message: 'Password updated successfully' } });
  } catch (error: any) {
    console.error('Update password error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to update password' } },
      { status: 500 }
    );
  }
}
