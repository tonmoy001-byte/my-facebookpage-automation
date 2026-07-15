// @ts-nocheck
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { uploadImage, uploadVideo } from '@/lib/cloudinary';

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Determine file type and upload
    const isVideo = file.type.startsWith('video/');
    const uploadFn = isVideo ? uploadVideo : uploadImage;

    const result = await uploadFn(buffer, `fb-autopost/${user.id}`);

    return NextResponse.json({
      url: result.secure_url,
      publicId: result.public_id,
      type: isVideo ? 'video' : 'image',
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to upload file' },
      { status: 500 }
    );
  }
}
