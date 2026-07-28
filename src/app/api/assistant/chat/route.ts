// @ts-nocheck
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { processAssistantMessage } from '@/lib/ai/assistant';
import { checkRateLimit } from '@/lib/rate-limit';
import { rateLimitConfig } from '@/lib/rate-limit-config';

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }, { status: 401 });
    }

    const rl = checkRateLimit(`ai:${user.tenantId}`, rateLimitConfig.ai);
    if (!rl.allowed) {
      return NextResponse.json({ success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests. Please wait.' } }, { status: 429 });
    }

    const { message, history } = await request.json();

    if (!message || !message.trim()) {
      return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Message is required' } }, { status: 400 });
    }

    const result = await processAssistantMessage({
      message: message.trim(),
      tenantId: user.tenantId,
      userId: user.id,
      history: history || [],
    });

    return NextResponse.json({
      success: true,
      data: {
        message: result.content,
        toolResults: result.toolResults,
      },
    });
  } catch (error: any) {
    console.error('Assistant chat error:', error);
    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to process message' },
    }, { status: 500 });
  }
}
