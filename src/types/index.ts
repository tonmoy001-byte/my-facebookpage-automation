// Facebook Automation SaaS - Type Definitions (v2 - Multi-tenant)

export interface User {
  id: string;
  email: string;
  name: string;
  tenantId: string;
  tenantName?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  settings?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface FacebookPage {
  id: string;
  userId: string;
  tenantId: string;
  pageId: string;
  pageName: string;
  connectedAt: Date;
  updatedAt: Date;
}

export interface Post {
  id: string;
  userId: string;
  tenantId: string;
  pageId: string;
  content: string;
  mediaUrls: string[];
  mediaType: 'text' | 'image' | 'video';
  brandVoice: string;
  status: 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed';
  facebookPostId?: string;
  publishedAt?: Date;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublishJob {
  id: string;
  postId: string;
  userId: string;
  tenantId: string;
  status: 'queued' | 'publishing' | 'published' | 'failed' | 'cancelled';
  scheduledAt: Date;
  timezone: string;
  facebookPostId?: string;
  attempts: number;
  maxAttempts: number;
  errorMessage?: string;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublishAttempt {
  id: string;
  jobId: string;
  tenantId: string;
  attemptNumber: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  facebookPostId?: string;
  errorMessage?: string;
  startedAt?: Date;
  finishedAt?: Date;
  createdAt: Date;
}

export interface ReplyRule {
  id: string;
  userId: string;
  tenantId: string;
  name: string;
  type: 'keyword' | 'sentiment' | 'time';
  isActive: boolean;
  priority: number;
  keywords: string[];
  sentiment?: string;
  daysOfWeek: string[];
  startTime?: string;
  endTime?: string;
  replyTemplate: string;
  action: 'template' | 'ai_reply' | 'escalate';
  createdAt: Date;
  updatedAt: Date;
}

export interface Comment {
  id: string;
  userId: string;
  tenantId: string;
  pageId: string;
  postId?: string;
  ruleId?: string;
  facebookCommentId: string;
  authorName: string;
  authorId: string;
  content: string;
  status: 'pending' | 'replied' | 'ignored';
  reply?: string;
  repliedAt?: Date;
  createdAt: Date;
}

export interface BrandVoice {
  id: string;
  name: string;
  slug: string;
  description: string;
  tone: string;
  styleGuide: string;
  examples: string[];
  isDefault: boolean;
  isGlobal: boolean;
  tenantId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Analytics {
  id: string;
  postId: string;
  userId: string;
  tenantId: string;
  postType: string;
  likes: number;
  comments: number;
  shares: number;
  reach: number;
  collectedAt: Date;
}

export interface Subscription {
  id: string;
  tenantId: string;
  plan: 'free' | 'starter' | 'pro' | 'enterprise';
  status: 'active' | 'cancelled' | 'past_due';
  postsPerMonth: number;
  postsUsed: number;
  maxPages: number;
  maxTeamMembers: number;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface MediaAsset {
  id: string;
  userId: string;
  tenantId: string;
  fileName: string;
  fileKey: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  mimeType: string;
  resourceType: 'image' | 'video';
  storageProvider: 'r2' | 'cloudinary';
  createdAt: Date;
}

export interface AICredential {
  id: string;
  tenantId: string;
  provider: 'openai' | 'anthropic' | 'google' | 'openrouter';
  apiKey: string;
  model?: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AISettings {
  id: string;
  tenantId: string;
  defaultProvider: string;
  defaultModel: string;
  temperature: number;
  maxTokens: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ActivityLog {
  id: string;
  userId: string;
  tenantId: string;
  action: string;
  details?: Record<string, any>;
  createdAt: Date;
}

export interface DashboardStats {
  totalPosts: number;
  scheduledPosts: number;
  publishedPosts: number;
  totalReplies: number;
  totalEngagement: number;
  averageReach: number;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}
