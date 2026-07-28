// @ts-nocheck
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma, tenantData } from '@/lib/prisma';
import { uploadToR2, generateMediaKey, isR2Configured } from '@/lib/storage';
import { checkRateLimit } from '@/lib/rate-limit';
import { rateLimitConfig } from '@/lib/rate-limit-config';

async function uploadToCloudinary(buffer: Buffer, folder: string, resourceType: string) {
  const { v2: cloudinary } = await import('cloudinary');
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: resourceType },
      (error: any, result: any) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    stream.end(buffer);
  });
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const rl = checkRateLimit(`upload:${user.tenantId}`, rateLimitConfig.authenticated);
    if (!rl.allowed) {
      return NextResponse.json({ success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests.' } }, { status: 429 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4', 'video/quicktime', 'video/webm',
    ];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Allowed: JPEG, PNG, GIF, WebP, MP4, QuickTime, WebM' }, { status: 400 });
    }

    const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
    const MAX_VIDEO_SIZE = 100 * 1024 * 1024;
    const isVideo = file.type.startsWith('video/');
    const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;

    if (file.size > maxSize) {
      return NextResponse.json({ error: `File too large. Max size: ${isVideo ? '100MB' : '10MB'}` }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const resourceType = isVideo ? 'video' : 'image';

    let url: string;
    let key: string;

    if (isR2Configured()) {
      key = generateMediaKey(user.id, file.name, isVideo ? 'video' : 'image');
      const r2Result = await uploadToR2(buffer, key, file.type);
      url = r2Result.url;
    } else {
      const result = await uploadToCloudinary(buffer, `fb-saas/${user.id}`, resourceType);
      url = result.secure_url;
      key = result.public_id;
    }

    const mediaAsset = await prisma.mediaAsset.create({
      data: tenantData(user.tenantId, {
        userId: user.id, fileName: file.name, fileKey: key, fileUrl: url,
        fileType: file.type, fileSize: file.size, mimeType: file.type,
        resourceType: isVideo ? 'video' : 'image',
        storageProvider: isR2Configured() ? 'r2' : 'cloudinary',
      }),
    });

    return NextResponse.json({ url, key, type: isVideo ? 'video' : 'image', mediaAssetId: mediaAsset.id });
  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: error.message || 'Failed to upload file' }, { status: 500 });
  }
}
