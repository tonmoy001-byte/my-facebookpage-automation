// @ts-nocheck
import axios from 'axios';
import FormData from 'form-data';
import { decrypt } from './encryption';

const GRAPH_API_VER = 'v19.0';
const BASE_URL = `https://graph.facebook.com/${GRAPH_API_VER}`;
const RATE_LIMIT = 200; // Facebook API calls per hour
const RATE_WINDOW = 3600000; // 1 hour in milliseconds

interface RateLimitInfo {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitInfo>();

export interface FacebookPost {
  id: string;
  message?: string;
  created_time?: string;
}

export interface FacebookComment {
  id: string;
  message: string;
  from: {
    name: string;
    id: string;
  };
  created_time: string;
}

class FacebookService {
  private accessToken: string;
  private pageId: string;

  constructor(accessToken: string, pageId: string) {
    this.accessToken = decrypt(accessToken);
    this.pageId = pageId;
  }

  private async checkRateLimit(): Promise<void> {
    const now = Date.now();
    const key = this.pageId;
    const info = rateLimitStore.get(key);

    if (!info || now > info.resetAt) {
      rateLimitStore.set(key, { count: 1, resetAt: now + RATE_WINDOW });
      return;
    }

    if (info.count >= RATE_LIMIT) {
      const waitTime = info.resetAt - now;
      throw new Error(`Rate limit exceeded. Please try again in ${Math.ceil(waitTime / 60000)} minutes.`);
    }

    info.count++;
  }

  async postToFeed(message: string): Promise<FacebookPost> {
    await this.checkRateLimit();

    const url = `${BASE_URL}/${this.pageId}/feed`;
    const response = await axios.post(url, {
      message,
      access_token: this.accessToken,
    });

    return response.data;
  }

  async postPhoto(imageUrl: string, caption: string): Promise<FacebookPost> {
    await this.checkRateLimit();

    const url = `${BASE_URL}/${this.pageId}/photos`;
    const response = await axios.post(url, {
      url: imageUrl,
      caption,
      access_token: this.accessToken,
    });

    return response.data;
  }

  async postMultiplePhotos(imageUrls: string[], caption: string): Promise<FacebookPost> {
    await this.checkRateLimit();

    // Upload all photos as unpublished first
    const mediaIds: string[] = [];
    for (const url of imageUrls) {
      const photoId = await this.uploadUnpublishedPhoto(url);
      mediaIds.push(photoId);
    }

    // Create post with attached media
    const feedUrl = `${BASE_URL}/${this.pageId}/feed`;
    const attachedMedia = mediaIds.map((id) => ({ media_fbid: id }));

    const response = await axios.post(feedUrl, {
      message: caption,
      attached_media: attachedMedia,
      access_token: this.accessToken,
    });

    return response.data;
  }

  private async uploadUnpublishedPhoto(imageUrl: string): Promise<string> {
    const url = `${BASE_URL}/${this.pageId}/photos`;
    const response = await axios.post(url, {
      url: imageUrl,
      published: false,
      access_token: this.accessToken,
    });

    return response.data.id;
  }

  async postVideo(videoUrl: string, description: string): Promise<FacebookPost> {
    await this.checkRateLimit();

    const url = `${BASE_URL}/${this.pageId}/videos`;
    const response = await axios.post(url, {
      file_url: videoUrl,
      description,
      access_token: this.accessToken,
    });

    return response.data;
  }

  async replyToComment(commentId: string, message: string): Promise<FacebookComment> {
    await this.checkRateLimit();

    const url = `${BASE_URL}/${commentId}/comments`;
    const response = await axios.post(url, {
      message,
      access_token: this.accessToken,
    });

    return response.data;
  }

  async deleteComment(commentId: string): Promise<void> {
    await this.checkRateLimit();

    const url = `${BASE_URL}/${commentId}`;
    await axios.delete(url, {
      params: { access_token: this.accessToken },
    });
  }

  async hideComment(commentId: string): Promise<void> {
    await this.checkRateLimit();

    const url = `${BASE_URL}/${commentId}`;
    await axios.post(url, {
      is_hidden: true,
      access_token: this.accessToken,
    });
  }

  async getPostInsights(postId: string): Promise<any> {
    await this.checkRateLimit();

    const url = `${BASE_URL}/${postId}/insights`;
    const response = await axios.get(url, {
      params: {
        metric: 'post_impressions,post_reactions_by_type_total,post_comments,post_shares',
        access_token: this.accessToken,
      },
    });

    return response.data;
  }

  async getPageStats(): Promise<any> {
    await this.checkRateLimit();

    const url = `${BASE_URL}/${this.pageId}`;
    const response = await axios.get(url, {
      params: {
        fields: 'fan_count,talking_about_count',
        access_token: this.accessToken,
      },
    });

    return response.data;
  }

  async verifyWebhook(mode: string, token: string, challenge: string): Promise<boolean> {
    if (mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN) {
      return true;
    }
    return false;
  }
}

export function createFacebookService(accessToken: string, pageId: string): FacebookService {
  return new FacebookService(accessToken, pageId);
}

export function verifyWebhookSignature(
  body: string,
  signature: string,
  appSecret: string
): boolean {
  const crypto = require('crypto');
  const expectedSignature = crypto
    .createHmac('sha256', appSecret)
    .update(body)
    .digest('hex');

  return signature === `sha256=${expectedSignature}`;
}
