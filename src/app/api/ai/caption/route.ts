// @ts-nocheck
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { generateCaption } from '@/lib/ai';

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { imageUrl, description, brandVoice, hashtags, maxHashtags, tone, maxLength } =
      await request.json();

    if (!description) {
      return NextResponse.json(
        { error: 'Description is required' },
        { status: 400 }
      );
    }

    const result = await generateCaption({
      imageUrl,
      description,
      brandVoice,
      hashtags,
      maxHashtags,
      tone,
      maxLength,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Caption generation error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate caption' },
      { status: 500 }
    );
  }
}
