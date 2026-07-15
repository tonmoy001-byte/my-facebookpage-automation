// @ts-nocheck
import { prisma } from './prisma';
import { generateReply } from './ai';
import { createFacebookService } from './facebook';

export interface ReplyRule {
  id: string;
  name: string;
  type: 'keyword' | 'sentiment' | 'time';
  isActive: boolean;
  priority: number;
  keywords?: string[];
  sentiment?: string;
  daysOfWeek?: string[];
  startTime?: string;
  endTime?: string;
  responseTemplate: string;
  useAI: boolean;
  brandVoiceId?: string;
}

export interface Comment {
  id: string;
  content: string;
  authorName: string;
  authorId: string;
  postId: string;
  pageId: string;
}

export interface RuleMatch {
  rule: ReplyRule;
  confidence: number;
}

// Keyword matching with fuzzy support
function matchKeywords(comment: string, keywords: string[]): number {
  const lowerComment = comment.toLowerCase();
  let matchCount = 0;

  for (const keyword of keywords) {
    const lowerKeyword = keyword.toLowerCase();
    if (lowerComment.includes(lowerKeyword)) {
      matchCount++;
    }
  }

  return matchCount / keywords.length;
}

// Simple sentiment analysis
function analyzeSentiment(comment: string): string {
  const lowerComment = comment.toLowerCase();

  const positiveWords = [
    'love', 'great', 'awesome', 'amazing', 'thank', 'good', 'nice',
    'happy', 'excellent', 'fantastic', 'wonderful', 'perfect', 'best',
    'beautiful', 'outstanding', 'superb', 'brilliant', 'impressive',
  ];

  const negativeWords = [
    'hate', 'bad', 'terrible', 'awful', 'worst', 'angry', 'upset',
    'disappointed', 'poor', 'horrible', 'disgusting', 'annoying',
    'frustrated', 'unacceptable', 'useless', 'waste', 'scam',
  ];

  let positiveCount = 0;
  let negativeCount = 0;

  for (const word of positiveWords) {
    if (lowerComment.includes(word)) positiveCount++;
  }

  for (const word of negativeWords) {
    if (lowerComment.includes(word)) negativeCount++;
  }

  if (positiveCount > negativeCount) return 'positive';
  if (negativeCount > positiveCount) return 'negative';
  return 'neutral';
}

// Time-based matching
function matchesTimeRule(
  daysOfWeek: string[],
  startTime: string,
  endTime: string
): boolean {
  const now = new Date();
  const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const currentDay = dayNames[now.getDay()];

  if (!daysOfWeek.includes(currentDay)) return false;

  const hours = now.getHours();
  const minutes = now.getMinutes();
  const currentTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

  if (startTime && endTime) {
    return currentTime >= startTime && currentTime <= endTime;
  }

  return true;
}

// Find matching rules for a comment
export async function findMatchingRules(
  comment: string,
  userId: string
): Promise<RuleMatch[]> {
  const rules = await prisma.replyRule.findMany({
    where: {
      userId,
      isActive: true,
    },
    orderBy: { priority: 'desc' },
  });

  const matches: RuleMatch[] = [];

  for (const rule of rules) {
    let confidence = 0;

    switch (rule.type) {
      case 'keyword':
        if (rule.keywords && rule.keywords.length > 0) {
          confidence = matchKeywords(comment, rule.keywords);
        }
        break;

      case 'sentiment':
        const sentiment = analyzeSentiment(comment);
        if (rule.sentiment === sentiment || rule.sentiment === 'any') {
          confidence = 0.8;
        }
        break;

      case 'time':
        if (
          rule.daysOfWeek &&
          rule.startTime &&
          rule.endTime
        ) {
          if (matchesTimeRule(rule.daysOfWeek, rule.startTime, rule.endTime)) {
            confidence = 0.9;
          }
        }
        break;
    }

    if (confidence > 0) {
      matches.push({ rule, confidence });
    }
  }

  // Sort by confidence and priority
  matches.sort((a, b) => {
    if (b.confidence !== a.confidence) {
      return b.confidence - a.confidence;
    }
    return b.rule.priority - a.rule.priority;
  });

  return matches;
}

// Generate reply based on rule
export async function generateRuleReply(
  rule: ReplyRule,
  comment: string,
  brandVoice?: string
): Promise<string> {
  if (rule.useAI) {
    return generateReply(comment, brandVoice || 'professional');
  }

  // Use template with variable substitution
  let reply = rule.responseTemplate;

  // Replace common variables
  reply = reply.replace('{comment}', comment);
  reply = reply.replace('{name}', '{name}'); // Would be replaced with actual name

  return reply;
}

// Process a comment and generate reply
export async function processComment(comment: Comment): Promise<string | null> {
  // Get the page and user info
  const page = await prisma.facebookPage.findUnique({
    where: { id: comment.pageId },
    include: { user: true },
  });

  if (!page) return null;

  // Find matching rules
  const matches = await findMatchingRules(comment.content, page.userId);

  if (matches.length === 0) return null;

  // Use the best matching rule
  const bestMatch = matches[0];

  // Get brand voice if specified
  let brandVoice = 'professional';
  if (bestMatch.rule.brandVoiceId) {
    const brandVoiceData = await prisma.brandVoice.findUnique({
      where: { id: bestMatch.rule.brandVoiceId },
    });
    if (brandVoiceData) {
      brandVoice = brandVoiceData.tone;
    }
  }

  // Generate reply
  const reply = await generateRuleReply(bestMatch.rule, comment.content, brandVoice);

  // Send reply via Facebook
  try {
    const fbService = createFacebookService(page.accessToken, page.pageId);
    await fbService.replyToComment(comment.id, reply);

    // Store the reply in database
    await prisma.comment.update({
      where: { facebookCommentId: comment.id },
      data: {
        reply,
        repliedAt: new Date(),
        ruleId: bestMatch.rule.id,
      },
    });

    return reply;
  } catch (error) {
    console.error('Failed to send reply:', error);
    return null;
  }
}
