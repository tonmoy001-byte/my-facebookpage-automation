// @ts-nocheck
import { prisma, tenantWhere } from './prisma';
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
  replyTemplate: string;
  action: string;
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

// Keyword matching
function matchKeywords(comment: string, keywords: string[]): number {
  const lowerComment = comment.toLowerCase();
  let matchCount = 0;
  for (const keyword of keywords) {
    if (lowerComment.includes(keyword.toLowerCase())) matchCount++;
  }
  return matchCount / keywords.length;
}

// Simple sentiment analysis
function analyzeSentiment(comment: string): string {
  const lower = comment.toLowerCase();
  const positive = ['love', 'great', 'awesome', 'amazing', 'thank', 'good', 'nice', 'happy', 'excellent', 'fantastic', 'wonderful', 'perfect', 'best'];
  const negative = ['hate', 'bad', 'terrible', 'awful', 'worst', 'angry', 'upset', 'disappointed', 'poor', 'horrible', 'annoying', 'frustrated', 'unacceptable'];

  let pos = 0, neg = 0;
  for (const w of positive) if (lower.includes(w)) pos++;
  for (const w of negative) if (lower.includes(w)) neg++;

  if (pos > neg) return 'positive';
  if (neg > pos) return 'negative';
  return 'neutral';
}

// Time-based matching
function matchesTimeRule(daysOfWeek: string[], startTime: string, endTime: string): boolean {
  const now = new Date();
  const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  if (!daysOfWeek.includes(dayNames[now.getDay()])) return false;
  const h = now.getHours().toString().padStart(2, '0');
  const m = now.getMinutes().toString().padStart(2, '0');
  const time = `${h}:${m}`;
  if (startTime && endTime) return time >= startTime && time <= endTime;
  return true;
}

// Find matching rules for a comment (tenant-scoped)
export async function findMatchingRules(
  comment: string,
  userId: string,
  tenantId: string
): Promise<RuleMatch[]> {
  const rules = await prisma.replyRule.findMany({
    where: tenantWhere(tenantId, { userId, isActive: true }),
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
        if (rule.sentiment === sentiment || rule.sentiment === 'any') confidence = 0.8;
        break;
      case 'time':
        if (rule.daysOfWeek?.length && rule.startTime && rule.endTime) {
          if (matchesTimeRule(rule.daysOfWeek, rule.startTime, rule.endTime)) confidence = 0.9;
        }
        break;
    }

    if (confidence > 0) matches.push({ rule, confidence });
  }

  matches.sort((a, b) => b.confidence - a.confidence || b.rule.priority - a.rule.priority);
  return matches;
}

// Generate reply based on rule
export async function generateRuleReply(
  rule: ReplyRule,
  comment: string,
  brandVoice?: string
): Promise<string> {
  if (rule.action === 'ai_reply') {
    return generateReply(comment, brandVoice || 'professional');
  }
  let reply = rule.replyTemplate || '';
  reply = reply.replace(/{comment}/g, comment);
  // Note: {name} is replaced by the caller with the actual commenter name
  return reply;
}

// Process a comment and generate reply
export async function processComment(comment: Comment): Promise<string | null> {
  const page = await prisma.facebookPage.findUnique({
    where: { id: comment.pageId },
  });
  if (!page) return null;

  const matches = await findMatchingRules(comment.content, page.userId, page.tenantId);
  if (matches.length === 0) return null;

  const bestMatch = matches[0];

  const brandVoice = 'professional';

  const reply = await generateRuleReply(bestMatch.rule, comment.content, brandVoice);

  try {
    const fbService = createFacebookService(page.accessToken, page.pageId);
    await fbService.replyToComment(comment.id, reply);

    await prisma.comment.update({
      where: { facebookCommentId: comment.id },
      data: { reply, repliedAt: new Date(), ruleId: bestMatch.rule.id },
    });

    return reply;
  } catch (error) {
    console.error('Failed to send reply:', error);
    return null;
  }
}
