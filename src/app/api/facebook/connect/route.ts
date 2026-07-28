// @ts-nocheck
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { encrypt } from '@/lib/encryption';
import { prisma, tenantWhere } from '@/lib/prisma';
import axios from 'axios';
import { checkRateLimit, markAuthFailed, resetBackoff } from '@/lib/rate-limit';
import { rateLimitConfig } from '@/lib/rate-limit-config';

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const rl = checkRateLimit(`fb-connect:${user.tenantId}`, rateLimitConfig.authenticated);
    if (!rl.allowed) {
      return NextResponse.json({ success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests.' } }, { status: 429 });
    }

    const { pageId, pageName, accessToken } = await request.json();

    if (!pageId || !pageName || !accessToken) {
      return NextResponse.json({ error: 'Page ID, name, and access token are required' }, { status: 400 });
    }

    try {
      const verifyUrl = `https://graph.facebook.com/v19.0/me?access_token=${accessToken}`;
      await axios.get(verifyUrl);
    } catch (error) {
      return NextResponse.json({ error: 'Invalid Facebook access token' }, { status: 400 });
    }

    const encryptedToken = encrypt(accessToken);

    const page = await prisma.facebookPage.upsert({
      where: { pageId },
      create: {
        userId: user.id,
        tenantId: user.tenantId,
        pageId,
        pageName,
        accessToken: encryptedToken,
        webhookToken: `wh_${Math.random().toString(36).substring(2, 15)}`,
      },
      update: {
        pageName,
        accessToken: encryptedToken,
        userId: user.id,
        tenantId: user.tenantId,
      },
    });

    return NextResponse.json({ page }, { status: 201 });
  } catch (error: any) {
    console.error('Facebook connect error:', error);
    return NextResponse.json({ error: error.message || 'Failed to connect Facebook page' }, { status: 500 });
  }
}
