// @ts-nocheck
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { suggestHashtags } from '@/lib/ai';

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { description, count } = await request.json();

    if (!description) {
      return NextResponse.json(
        { error: 'Description is required' },
        { status: 400 }
      );
    }

    const hashtags = await suggestHashtags(description, count || 5, user.tenantId);

    return NextResponse.json({ hashtags });
  } catch (error: any) {
    console.error('Hashtag suggestion error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to suggest hashtags' },
      { status: 500 }
    );
  }
}
