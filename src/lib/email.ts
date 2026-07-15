// @ts-nocheck
import sgMail from '@sendgrid/mail';

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@fbautopost.com';

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

// Generic send email function
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  if (!SENDGRID_API_KEY) {
    console.warn('SendGrid API key not configured, email not sent');
    return false;
  }

  try {
    await sgMail.send({
      to: options.to,
      from: FROM_EMAIL,
      subject: options.subject,
      html: options.html,
      text: options.text || options.html.replace(/<[^>]*>/g, ''),
    });
    return true;
  } catch (error) {
    console.error('Failed to send email:', error);
    return false;
  }
}

// Post published notification
export async function sendPostPublishedNotification(
  email: string,
  postCaption: string,
  pageName: string
): Promise<boolean> {
  const subject = 'Your post has been published!';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2563eb;">Post Published Successfully</h2>
      <p>Your post has been published to <strong>${pageName}</strong>.</p>
      <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <p style="margin: 0; color: #374151;">${postCaption.substring(0, 200)}${postCaption.length > 200 ? '...' : ''}</p>
      </div>
      <p style="color: #6b7280; font-size: 14px;">
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard" style="color: #2563eb;">View Dashboard</a>
      </p>
    </div>
  `;

  return sendEmail({ to: email, subject, html });
}

// Schedule reminder notification
export async function sendScheduleReminder(
  email: string,
  postCaption: string,
  scheduledTime: string
): Promise<boolean> {
  const subject = 'Reminder: Post scheduled to publish soon';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #f59e0b;">Schedule Reminder</h2>
      <p>You have a post scheduled to publish at <strong>${scheduledTime}</strong>.</p>
      <div style="background: #fef3c7; padding: 16px; border-radius: 8px; margin: 16px 0; border-left: 4px solid #f59e0b;">
        <p style="margin: 0; color: #92400e;">${postCaption.substring(0, 200)}${postCaption.length > 200 ? '...' : ''}</p>
      </div>
      <p style="color: #6b7280; font-size: 14px;">
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/schedule" style="color: #2563eb;">View Schedule</a>
      </p>
    </div>
  `;

  return sendEmail({ to: email, subject, html });
}

// Weekly analytics report
export async function sendWeeklyReport(
  email: string,
  stats: {
    totalPosts: number;
    totalImpressions: number;
    totalEngagement: number;
    topPostCaption?: string;
  }
): Promise<boolean> {
  const subject = 'Your Weekly FB AutoPost Report';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2563eb;">Weekly Report</h2>
      <p>Here's your performance summary for the past week:</p>
      
      <div style="display: flex; gap: 16px; margin: 24px 0;">
        <div style="flex: 1; background: #eff6ff; padding: 16px; border-radius: 8px; text-align: center;">
          <p style="font-size: 24px; font-weight: bold; color: #2563eb; margin: 0;">${stats.totalPosts}</p>
          <p style="color: #6b7280; margin: 8px 0 0 0;">Posts Published</p>
        </div>
        <div style="flex: 1; background: #f0fdf4; padding: 16px; border-radius: 8px; text-align: center;">
          <p style="font-size: 24px; font-weight: bold; color: #16a34a; margin: 0;">${stats.totalImpressions.toLocaleString()}</p>
          <p style="color: #6b7280; margin: 8px 0 0 0;">Impressions</p>
        </div>
        <div style="flex: 1; background: #faf5ff; padding: 16px; border-radius: 8px; text-align: center;">
          <p style="font-size: 24px; font-weight: bold; color: #9333ea; margin: 0;">${stats.totalEngagement.toLocaleString()}</p>
          <p style="color: #6b7280; margin: 8px 0 0 0;">Engagement</p>
        </div>
      </div>

      ${stats.topPostCaption ? `
        <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p style="font-weight: bold; margin: 0 0 8px 0; color: #374151;">Top Post This Week:</p>
          <p style="margin: 0; color: #6b7280;">${stats.topPostCaption.substring(0, 150)}...</p>
        </div>
      ` : ''}

      <p style="color: #6b7280; font-size: 14px; margin-top: 24px;">
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/analytics" style="color: #2563eb;">View Full Analytics</a>
      </p>
    </div>
  `;

  return sendEmail({ to: email, subject, html });
}

// Welcome email
export async function sendWelcomeEmail(
  email: string,
  name: string
): Promise<boolean> {
  const subject = 'Welcome to FB AutoPost!';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2563eb;">Welcome to FB AutoPost!</h2>
      <p>Hi ${name},</p>
      <p>Thank you for joining FB AutoPost! Here's how to get started:</p>
      
      <ol style="color: #374151; line-height: 1.8;">
        <li><strong>Connect your Facebook Page</strong> - Go to Settings to connect your page</li>
        <li><strong>Create your first post</strong> - Use AI to generate engaging captions</li>
        <li><strong>Schedule posts</strong> - Plan your content calendar</li>
        <li><strong>Set up auto-reply rules</strong> - Automate comment responses</li>
      </ol>

      <p style="margin-top: 24px;">
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none;">Get Started</a>
      </p>

      <p style="color: #6b7280; font-size: 14px; margin-top: 24px;">
        If you have any questions, just reply to this email!
      </p>
    </div>
  `;

  return sendEmail({ to: email, subject, html });
}
