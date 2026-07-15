// @ts-nocheck
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export interface UploadResult {
  public_id: string;
  secure_url: string;
  resource_type: string;
  format: string;
  bytes: number;
}

export async function uploadImage(
  file: Buffer | string,
  folder: string = 'fb-autopost'
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const uploadOptions = {
      folder,
      resource_type: 'image' as const,
      transformation: [{ quality: 'auto', fetch_format: 'auto' }],
    };

    if (typeof file === 'string') {
      // URL upload
      cloudinary.uploader.upload(file, uploadOptions, (error, result) => {
        if (error) reject(error);
        else resolve(result as UploadResult);
      });
    } else {
      // Buffer upload
      const uploadStream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) reject(error);
          else resolve(result as UploadResult);
        }
      );
      uploadStream.end(file);
    }
  });
}

export async function uploadVideo(
  file: Buffer | string,
  folder: string = 'fb-autopost'
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const uploadOptions = {
      folder,
      resource_type: 'video' as const,
    };

    if (typeof file === 'string') {
      cloudinary.uploader.upload(file, uploadOptions, (error, result) => {
        if (error) reject(error);
        else resolve(result as UploadResult);
      });
    } else {
      const uploadStream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) reject(error);
          else resolve(result as UploadResult);
        }
      );
      uploadStream.end(file);
    }
  });
}

export async function deleteFile(publicId: string): Promise<void> {
  await cloudinary.uploader.destroy(publicId);
}

export function getOptimizedUrl(
  publicId: string,
  options: {
    width?: number;
    height?: number;
    quality?: number;
    format?: string;
  } = {}
): string {
  const transformation: any[] = [];

  if (options.width || options.height) {
    transformation.push({
      width: options.width,
      height: options.height,
      crop: 'fill',
    });
  }

  if (options.quality) {
    transformation.push({ quality: options.quality });
  }

  return cloudinary.url(publicId, {
    transformation,
    secure: true,
  });
}
