// @ts-nocheck
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { encrypt } from '@/lib/encryption';
import { prisma } from '@/lib/prisma';
import axios from 'axios';

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { pageId, pageName, accessToken } = await request.json();

    if (!pageId || !pageName || !accessToken) {
      return NextResponse.json(
        { error: 'Page ID, name, and access token are required' },
        { status: 400 }
      );
    }

    // Verify the access token is valid by making a test API call
    try {
      const verifyUrl = `https://graph.facebook.com/v19.0/me?access_token=${accessToken}`;
      await axios.get(verifyUrl);
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid Facebook access token' },
        { status: 400 }
      );
    }

    // Check if user already has a page connected
    const existingPage = await prisma.facebookPage.findUnique({
      where: { userId: user.id },
    });

    if (existingPage) {
      // Update existing page
      const updatedPage = await prisma.facebookPage.update({
        where: { userId: user.id },
        data: {
          pageId,
          pageName,
          accessToken: encrypt(accessToken),
        },
      });
      return NextResponse.json({ page: updatedPage });
    }

    // Create new page connection
    const page = await prisma.facebookPage.create({
      data: {
        userId: user.id,
        pageId,
        pageName,
        accessToken: encrypt(accessToken),
        webhookToken: `wh_${Math.random().toString(36).substring(2, 15)}`,
      },
    });

    return NextResponse.json({ page }, { status: 201 });
  } catch (error: any) {
    console.error('Facebook connect error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to connect Facebook page' },
      { status: 500 }
    );
  }
}
