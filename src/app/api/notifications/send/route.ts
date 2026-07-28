// @ts-nocheck
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { sendPostPublishedNotification, sendScheduleReminder, sendWeeklyReport } from '@/lib/email';
import { checkRateLimit } from '@/lib/rate-limit';
import { rateLimitConfig } from '@/lib/rate-limit-config';

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const rl = checkRateLimit(`notifications:${user.tenantId}`, rateLimitConfig.authenticated);
    if (!rl.allowed) {
      return NextResponse.json({ success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests.' } }, { status: 429 });
    }

    const { type, data } = await request.json();

    let success = false;

    switch (type) {
      case 'post_published':
        success = await sendPostPublishedNotification(user.email, data.postCaption, data.pageName);
        break;
      case 'schedule_reminder':
        success = await sendScheduleReminder(user.email, data.postCaption, data.scheduledTime);
        break;
      case 'weekly_report':
        success = await sendWeeklyReport(user.email, data.stats);
        break;
      default:
        return NextResponse.json({ error: 'Invalid notification type' }, { status: 400 });
    }

    return NextResponse.json({ success });
  } catch (error: any) {
    console.error('Send notification error:', error);
    return NextResponse.json({ error: error.message || 'Failed to send notification' }, { status: 500 });
  }
}
