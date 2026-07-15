// @ts-nocheck
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

const brandVoices = [
  {
    name: 'Professional Business',
    slug: 'professional',
    description: 'Formal, corporate tone suitable for B2B and professional services',
    tone: 'professional, authoritative, trustworthy',
    styleGuide: 'Use formal language, avoid slang. Be concise and direct. Focus on value propositions and expertise. Use industry-specific terminology when appropriate.',
    examples: [
      'We are pleased to announce our latest solution designed to streamline your operations.',
      'Our team of experts is committed to delivering exceptional results for your business.',
    ],
    isDefault: true,
  },
  {
    name: 'Casual Friendly',
    slug: 'casual',
    description: 'Conversational, approachable, warm tone for lifestyle brands',
    tone: 'casual, friendly, approachable',
    styleGuide: 'Use conversational language as if talking to a friend. Use contractions. Be warm and inviting. Include emojis sparingly for emphasis.',
    examples: [
      'Hey there! Just wanted to share something cool we\'ve been working on! 🎉',
      'Thanks for being part of our community. We love hearing from you!',
    ],
    isDefault: false,
  },
  {
    name: 'Emotional Storytelling',
    slug: 'emotional',
    description: 'Narrative-driven, empathetic tone that connects on a personal level',
    tone: 'emotional, empathetic, narrative',
    styleGuide: 'Tell stories that resonate. Use sensory language. Create emotional connections. Share user journeys and transformations.',
    examples: [
      'Remember when you first started your journey? We\'ve been there too. That\'s why we created something special just for you.',
      'Every day, we see people just like you achieving their dreams. Here\'s another inspiring story...',
    ],
    isDefault: false,
  },
  {
    name: 'Tech Startup',
    slug: 'tech-startup',
    description: 'Innovative, energetic, forward-thinking tone for tech companies',
    tone: 'innovative, energetic, forward-thinking',
    styleGuide: 'Use modern tech vocabulary. Be excited about innovation. Focus on future possibilities. Use data and metrics when possible.',
    examples: [
      '🚀 Exciting news! Our latest update is here to supercharge your workflow.',
      'The future of [industry] is here. Are you ready to be part of it?',
    ],
    isDefault: false,
  },
  {
    name: 'Local Business',
    slug: 'local',
    description: 'Community-focused, personal, trustworthy tone for local businesses',
    tone: 'community-focused, personal, trustworthy',
    styleGuide: 'Emphasize local connections. Reference the community by name. Be personal and genuine. Highlight local impact.',
    examples: [
      'Your neighborhood [business type] is here for you! Stop by and say hi!',
      'Proudly serving our community for [X] years. Thank you for your support!',
    ],
    isDefault: false,
  },
  {
    name: 'E-commerce Sales',
    slug: 'ecommerce',
    description: 'Promotional, urgency-driven, action-oriented tone for online stores',
    tone: 'promotional, urgency-driven, action-oriented',
    styleGuide: 'Create urgency with limited-time offers. Use strong calls to action. Highlight benefits and savings. Use power words like "exclusive", "limited", "now".',
    examples: [
      '🔥 FLASH SALE: 50% off everything for the next 24 hours! Don\'t miss out!',
      'Your cart is waiting! Complete your order now and get free shipping.',
    ],
    isDefault: false,
  },
  {
    name: 'Educational',
    slug: 'educational',
    description: 'Informative, helpful, expert tone for educational content',
    tone: 'informative, helpful, expert',
    styleGuide: 'Provide value through education. Use clear explanations. Include tips and how-tos. Position as a thought leader.',
    examples: [
      '💡 Did you know? Here\'s a quick tip to help you [achieve goal].',
      'Let us break this down for you. Understanding [topic] is easier than you think.',
    ],
    isDefault: false,
  },
  {
    name: 'Entertainment',
    slug: 'entertainment',
    description: 'Fun, humorous, engaging tone for entertainment brands',
    tone: 'fun, humorous, engaging',
    styleGuide: 'Be playful and lighthearted. Use humor appropriately. Create shareable content. Use pop culture references when relevant.',
    examples: [
      'POV: You just discovered the best [thing] ever 😂',
      'Tag someone who needs to see this! 👇',
    ],
    isDefault: false,
  },
  {
    name: 'Health & Wellness',
    slug: 'health-wellness',
    description: 'Calming, supportive, caring tone for health and wellness brands',
    tone: 'calming, supportive, caring',
    styleGuide: 'Use gentle, supportive language. Focus on well-being and self-care. Be encouraging without being pushy. Use calming imagery words.',
    examples: [
      'Take a deep breath. You deserve this moment of peace. 🌿',
      'Your wellness journey matters. We\'re here to support you every step of the way.',
    ],
    isDefault: false,
  },
  {
    name: 'Luxury Premium',
    slug: 'luxury',
    description: 'Sophisticated, exclusive, aspirational tone for luxury brands',
    tone: 'sophisticated, exclusive, aspirational',
    styleGuide: 'Use elegant, refined language. Emphasize exclusivity and quality. Avoid salesy language. Focus on craftsmanship and experience.',
    examples: [
      'Experience the art of [craft]. Where every detail matters.',
      'For those who appreciate the finer things. Introducing our latest collection.',
    ],
    isDefault: false,
  },
];

async function main() {
  console.log('Seeding brand voices...');

  for (const voice of brandVoices) {
    await prisma.brandVoice.upsert({
      where: { slug: voice.slug },
      update: voice,
      create: voice,
    });
  }

  console.log(`Seeded ${brandVoices.length} brand voices`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
