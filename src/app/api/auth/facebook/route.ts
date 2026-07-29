// @ts-nocheck
import { NextResponse } from 'next/server';

const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID;
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL || 'https://fb-saas.vercel.app'}/api/auth/facebook/callback`;

export async function GET(request: Request) {
  try {
    if (!FACEBOOK_APP_ID) {
      return NextResponse.json(
        { success: false, error: { code: 'CONFIG_ERROR', message: 'Facebook App ID not configured' } },
        { status: 500 }
      );
    }

    const scopes = 'email,public_profile,pages_show_list,pages_manage_posts,pages_read_engagement,pages_read_user_content';

    const facebookAuthUrl = new URL('https://www.facebook.com/v19.0/dialog/oauth');
    facebookAuthUrl.searchParams.set('client_id', FACEBOOK_APP_ID);
    facebookAuthUrl.searchParams.set('redirect_uri', REDIRECT_URI);
    facebookAuthUrl.searchParams.set('scope', scopes);
    facebookAuthUrl.searchParams.set('response_type', 'code');
    facebookAuthUrl.searchParams.set('state', 'fb_login');

    return NextResponse.redirect(facebookAuthUrl.toString());
  } catch (error: any) {
    console.error('Facebook OAuth redirect error:', error);
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL || 'https://fb-saas.vercel.app'}/login?error=facebook_auth_failed`);
  }
}
