// @ts-nocheck
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateToken } from '@/lib/auth';

const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID;
const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET;
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL || 'https://fb-saas.vercel.app'}/api/auth/facebook/callback`;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://fb-saas.vercel.app';

    if (error) {
      return NextResponse.redirect(`${baseUrl}/login?error=facebook_denied`);
    }

    if (!code) {
      return NextResponse.redirect(`${baseUrl}/login?error=no_code`);
    }

    if (!FACEBOOK_APP_ID || !FACEBOOK_APP_SECRET) {
      return NextResponse.redirect(`${baseUrl}/login?error=facebook_not_configured`);
    }

    // Exchange code for access token
    const tokenRes = await fetch(
      `https://graph.facebook.com/v19.0/oauth/access_token?client_id=${FACEBOOK_APP_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&client_secret=${FACEBOOK_APP_SECRET}&code=${code}`
    );
    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      console.error('Facebook token error:', tokenData.error);
      return NextResponse.redirect(`${baseUrl}/login?error=token_exchange_failed`);
    }

    const accessToken = tokenData.access_token;

    // Get user info from Facebook
    const userRes = await fetch(
      `https://graph.facebook.com/v19.0/me?fields=id,name,email&access_token=${accessToken}`
    );
    const fbUser = await userRes.json();

    if (fbUser.error || !fbUser.id) {
      console.error('Facebook user info error:', fbUser.error);
      return NextResponse.redirect(`${baseUrl}/login?error=facebook_user_info_failed`);
    }

    const { id: facebookId, name, email } = fbUser;

    // Use a placeholder email if Facebook doesn't provide one
    const userEmail = email || `${facebookId}@facebook.local`;

    // Find existing user by facebookId or email
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { facebookId: facebookId },
          { email: userEmail },
        ],
      },
      include: { tenant: true },
    });

    if (user) {
      // Update existing user with facebookId if not set
      if (!user.facebookId) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { facebookId },
          include: { tenant: true },
        });
      }
    } else {
      // Create new user + tenant
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now().toString(36);

      const result = await prisma.$transaction(async (tx) => {
        const tenant = await tx.tenant.create({
          data: { name: `${name}'s Workspace`, slug },
        });

        const newUser = await tx.user.create({
          data: {
            email: userEmail,
            name,
            facebookId,
            tenantId: tenant.id,
            passwordHash: null,
          },
        });

        await tx.subscription.create({
          data: { tenantId: tenant.id, plan: 'starter', status: 'active' },
        });

        await tx.aISettings.create({
          data: {
            tenantId: tenant.id,
            defaultProvider: 'openrouter',
            defaultModel: 'google/gemini-2.0-flash:free',
          },
        });

        return { user: newUser, tenant };
      });

      user = result.user as any;
      user!.tenant = result.tenant as any;
    }

    // Generate JWT
    const token = generateToken({
      userId: user!.id,
      email: user!.email,
      name: user!.name,
      tenantId: user!.tenantId,
    });

    // Redirect to client-side callback page — it stores token in localStorage then redirects to dashboard
    return NextResponse.redirect(`${baseUrl}/auth/callback?token=${encodeURIComponent(token)}`);
  } catch (error: any) {
    console.error('Facebook OAuth callback error:', error);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://fb-saas.vercel.app';
    return NextResponse.redirect(`${baseUrl}/login?error=facebook_callback_failed`);
  }
}
