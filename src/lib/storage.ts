// @ts-nocheck
import { S3Client, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

// Cloudflare R2 config (S3-compatible)
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY
const R2_BUCKET = process.env.R2_BUCKET_NAME || 'fb-saas-media'
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || ''

let r2Client: S3Client | null = null

function getR2Client(): S3Client | null {
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    return null
  }

  if (!r2Client) {
    r2Client = new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    })
  }

  return r2Client
}

/**
 * Upload a file to Cloudflare R2.
 * Returns the public URL of the uploaded file.
 */
export async function uploadToR2(
  file: Buffer,
  key: string,
  contentType: string
): Promise<{ url: string; key: string }> {
  const client = getR2Client()

  if (!client) {
    // Fallback: return a placeholder URL if R2 is not configured
    console.warn('R2 not configured — upload skipped')
    return { url: '', key }
  }

  await client.send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    Body: file,
    ContentType: contentType,
  }))

  // Construct public URL
  const url = R2_PUBLIC_URL
    ? `${R2_PUBLIC_URL}/${key}`
    : `https://${R2_BUCKET}.${R2_ACCOUNT_ID}.r2.dev/${key}`

  return { url, key }
}

/**
 * Delete a file from Cloudflare R2.
 */
export async function deleteFromR2(key: string): Promise<void> {
  const client = getR2Client()
  if (!client) return

  await client.send(new DeleteObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
  }))
}

/**
 * Check if a file exists in R2.
 */
export async function fileExists(key: string): Promise<boolean> {
  const client = getR2Client()
  if (!client) return false

  try {
    await client.send(new HeadObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
    }))
    return true
  } catch {
    return false
  }
}

/**
 * Generate a presigned URL for upload (for client-side direct upload).
 */
export async function getPresignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn: number = 3600
): Promise<string> {
  const client = getR2Client()
  if (!client) throw new Error('R2 not configured')

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    ContentType: contentType,
  })

  return getSignedUrl(client, command, { expiresIn })
}

/**
 * Generate a unique key for a media asset.
 */
export function generateMediaKey(userId: string, fileName: string, type: 'image' | 'video'): string {
  const ext = fileName.split('.').pop() || (type === 'video' ? 'mp4' : 'jpg')
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  return `${type}s/${userId}/${timestamp}-${random}.${ext}`
}

/**
 * Check if R2 is configured.
 */
export function isR2Configured(): boolean {
  return getR2Client() !== null
}
