export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface FacebookPage {
  id: string;
  userId: string;
  pageId: string;
  pageName: string;
  connectedAt: Date;
}

export interface Post {
  id: string;
  userId: string;
  pageId: string;
  content: string;
  mediaUrls: string[];
  mediaType: 'text' | 'image' | 'video';
  brandVoice: string;
  status: 'draft' | 'scheduled' | 'published' | 'failed';
  facebookPostId?: string;
  publishedAt?: Date;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Schedule {
  id: string;
  postId: string;
  userId: string;
  scheduledAt: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  retryCount: number;
  createdAt: Date;
}

export interface ReplyRule {
  id: string;
  userId: string;
  name: string;
  description?: string;
  isActive: boolean;
  type: 'keyword' | 'sentiment' | 'time';
  keywords: string[];
  sentiment?: 'positive' | 'negative' | 'neutral';
  startTime?: string;
  endTime?: string;
  daysOfWeek: string[];
  action: 'reply' | 'skip' | 'flag';
  replyTemplate?: string;
  createdAt: Date;
  updatedAt: Date;
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
  createdAt: Date;
  updatedAt: Date;
}

export interface Analytics {
  id: string;
  userId: string;
  postId: string;
  postType: 'post' | 'comment_reply';
  likes: number;
  comments: number;
  shares: number;
  reach: number;
  collectedAt: Date;
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
