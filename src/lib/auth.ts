import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from './prisma';

const JWT_SECRET = process.env.JWT_SECRET as string;
if (!JWT_SECRET) throw new Error('JWT_SECRET environment variable is required');
const SALT_ROUNDS = 12;

export interface JWTPayload {
  userId: string;
  email: string;
  name: string;
  tenantId: string;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch {
    return null;
  }
}

export async function createUser(email: string, password: string, name: string) {
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw new Error('User already exists');
  }

  const passwordHash = await hashPassword(password);

  // Create tenant + user + subscription in a transaction
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now().toString(36);

  const result = await prisma.$transaction(async (tx) => {
    // 1. Create tenant
    const tenant = await tx.tenant.create({
      data: {
        name: `${name}'s Workspace`,
        slug,
      },
    });

    // 2. Create user
    const user = await tx.user.create({
      data: {
        email,
        passwordHash,
        name,
        tenantId: tenant.id,
      },
    });

    // 3. Create starter subscription
    await tx.subscription.create({
      data: {
        tenantId: tenant.id,
        plan: 'starter',
        status: 'active',
      },
    });

    // 4. Create default AI settings
    await tx.aISettings.create({
      data: {
        tenantId: tenant.id,
        defaultProvider: 'openrouter',
        defaultModel: 'google/gemini-2.0-flash:free',
      },
    });

    return { user, tenant };
  });

  return {
    id: result.user.id,
    email: result.user.email,
    name: result.user.name,
    tenantId: result.tenant.id,
    tenantName: result.tenant.name,
  };
}

export async function authenticateUser(email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { tenant: true },
  });
  if (!user) {
    throw new Error('Invalid credentials');
  }

  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) {
    throw new Error('Invalid credentials');
  }

  const token = generateToken({
    userId: user.id,
    email: user.email,
    name: user.name,
    tenantId: user.tenantId,
  });

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      tenantId: user.tenantId,
      tenantName: user.tenant.name,
    },
  };
}

export function getTokenFromRequest(request: Request): string | null {
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return null;
}

export async function getCurrentUser(request: Request) {
  const token = getTokenFromRequest(request);
  if (!token) return null;

  const payload = verifyToken(token);
  if (!payload) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      email: true,
      name: true,
      tenantId: true,
      tenant: { select: { id: true, name: true, slug: true } },
    },
  });

  return user;
}

export async function getAuthPayload(request: Request): Promise<JWTPayload | null> {
  const token = getTokenFromRequest(request);
  if (!token) return null;
  return verifyToken(token);
}
