// @ts-nocheck
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { callOpenRouter, imageToBase64DataUri, getLanguageInstruction, type OpenRouterMessage } from '@/lib/ai/client';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    // Rate limit: 10 requests per minute per tenant
    const rateLimitKey = `ai-image:${user.tenantId}`;
    const allowed = checkRateLimit(rateLimitKey, 10, 60000);
    if (!allowed) {
      return NextResponse.json(
        { success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests. Try again in a minute.' } },
        { status: 429 }
      );
    }

    const { imageUrl, language } = await request.json();

    if (!imageUrl) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Image URL is required' } },
        { status: 400 }
      );
    }

    const langInstruction = getLanguageInstruction(language || 'EN');

    const dataUri = await imageToBase64DataUri(imageUrl);

    const messages: OpenRouterMessage[] = [
      {
        role: 'system',
        content: `You are an image analysis AI. Analyze the provided image and return structured data.
${langInstruction}
Return your analysis as JSON:
{
  "description": "A detailed description of what you see in the image",
  "objects": ["list", "of", "main", "objects"],
  "scene": "the overall scene or setting",
  "confidence": "high" | "medium" | "low"
}`,
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Analyze this image and return the structured JSON response.' },
          { type: 'image_url', image_url: { url: dataUri } },
        ],
      },
    ];

    const content = await callOpenRouter(messages, {
      tenantId: user.tenantId,
      maxTokens: 500,
    });

    try {
      const parsed = JSON.parse(content);
      return NextResponse.json({
        success: true,
        data: {
          description: parsed.description || '',
          objects: Array.isArray(parsed.objects) ? parsed.objects : [],
          scene: parsed.scene || '',
          confidence: parsed.confidence || 'medium',
        },
      });
    } catch {
      // If JSON parsing fails, return the raw text as description
      return NextResponse.json({
        success: true,
        data: {
          description: content.trim(),
          objects: [],
          scene: '',
          confidence: 'low',
        },
      });
    }
  } catch (error: any) {
    console.error('Image analysis error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'AI_ERROR', message: error.message || 'Failed to analyze image' } },
      { status: 500 }
    );
  }
}
