// @ts-nocheck
import { prisma, tenantData } from '../prisma';

async function getCloudinary() {
  const { v2: cloudinary } = await import('cloudinary');
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  return cloudinary;
}

export async function uploadBufferToCloudinary(
  buffer: Buffer,
  folder: string,
  resourceType: string = 'image'
): Promise<{ url: string; publicId: string }> {
  const cloudinary = await getCloudinary();

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: resourceType },
      (error: any, result: any) => {
        if (error) reject(error);
        else resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );
    stream.end(buffer);
  });
}

export async function uploadBase64ToCloudinary(
  base64Data: string,
  folder: string,
  mimeType: string = 'image/png'
): Promise<{ url: string; publicId: string }> {
  const base64Clean = base64Data.replace(/^data:[^;]+;base64,/, '');
  const buffer = Buffer.from(base64Clean, 'base64');
  const format = mimeType.split('/')[1] || 'png';
  const cloudinary = await getCloudinary();

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'image', format },
      (error: any, result: any) => {
        if (error) reject(error);
        else resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );
    stream.end(buffer);
  });
}

export async function createMediaAsset(
  tenantId: string,
  userId: string,
  url: string,
  key: string,
  fileName: string,
  mimeType: string,
  fileSize: number
) {
  return prisma.mediaAsset.create({
    data: tenantData(tenantId, {
      userId,
      fileName,
      fileKey: key,
      fileUrl: url,
      fileType: mimeType,
      fileSize,
      mimeType,
      resourceType: 'image',
      storageProvider: 'cloudinary',
    }),
  });
}
