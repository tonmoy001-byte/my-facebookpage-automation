// @ts-nocheck
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { suggestHashtags } from '@/lib/ai/hashtags';
import { checkRateLimit } from '@/lib/rate-limit';
import { rateLimitConfig } from '@/lib/rate-limit-config';

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    const rl = checkRateLimit(`ai:hashtags:${user.tenantId}`, rateLimitConfig.ai);
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests. Try again in a minute.' } },
        { status: 429 }
      );
    }

    const { description, language, tone, count } = await request.json();

    if (!description) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Description is required' } },
        { status: 400 }
      );
    }

    if (language && !['EN', 'BN'].includes(language)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Language must be EN or BN' } },
        { status: 400 }
      );
    }

    const hashtags = await suggestHashtags({
      description,
      language: language || 'EN',
      tone: tone || 'professional',
      count: count || 5,
      tenantId: user.tenantId,
    });

    return NextResponse.json({
      success: true,
      data: { hashtags },
    });
  } catch (error: any) {
    console.error('Hashtag suggestion error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'AI_ERROR', message: error.message || 'Failed to suggest hashtags' } },
      { status: 500 }
    );
  }
}
