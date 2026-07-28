// @ts-nocheck
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { generateCaption } from '@/lib/ai/caption';
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

    const rl = checkRateLimit(`ai:caption:${user.tenantId}`, rateLimitConfig.ai);
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests. Try again in a minute.' } },
        { status: 429 }
      );
    }

    const { imageUrl, description, language, tone, brandVoiceId, includeHashtags, maxHashtags } =
      await request.json();

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

    const result = await generateCaption({
      tenantId: user.tenantId,
      imageUrl,
      description,
      language: language || 'EN',
      brandVoiceId,
      includeHashtags: includeHashtags !== false,
      maxHashtags: maxHashtags || 5,
    });

    return NextResponse.json({
      success: true,
      data: {
        ...result,
        language: language || 'EN',
        tone: tone || 'professional',
      },
    });
  } catch (error: any) {
    console.error('Caption generation error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'AI_ERROR', message: error.message || 'Failed to generate caption' } },
      { status: 500 }
    );
  }
}
