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
    styleGuide: 'Use formal language, avoid slang. Be concise and direct. Focus on value propositions and expertise.',
    examples: [
      'We are pleased to announce our latest solution designed to streamline your operations.',
      'Our team of experts is committed to delivering exceptional results for your business.',
    ],
    isDefault: true,
    isGlobal: true,
  },
  {
    name: 'Casual Friendly',
    slug: 'casual',
    description: 'Conversational, approachable, warm tone for lifestyle brands',
    tone: 'casual, friendly, approachable',
    styleGuide: 'Use conversational language as if talking to a friend. Use contractions. Be warm and inviting.',
    examples: [
      'Hey there! Just wanted to share something cool we\'ve been working on!',
      'Thanks for being part of our community. We love hearing from you!',
    ],
    isDefault: false,
    isGlobal: true,
  },
  {
    name: 'Emotional Storytelling',
    slug: 'emotional',
    description: 'Narrative-driven, empathetic tone that connects on a personal level',
    tone: 'emotional, empathetic, narrative',
    styleGuide: 'Tell stories that resonate. Use sensory language. Create emotional connections.',
    examples: [
      'Remember when you first started your journey? We\'ve been there too.',
      'Every day, we see people just like you achieving their dreams.',
    ],
    isDefault: false,
    isGlobal: true,
  },
  {
    name: 'Tech Startup',
    slug: 'tech-startup',
    description: 'Innovative, energetic, forward-thinking tone for tech companies',
    tone: 'innovative, energetic, forward-thinking',
    styleGuide: 'Use modern tech vocabulary. Be excited about innovation. Focus on future possibilities.',
    examples: [
      'Exciting news! Our latest update is here to supercharge your workflow.',
      'The future of your industry is here. Are you ready to be part of it?',
    ],
    isDefault: false,
    isGlobal: true,
  },
  {
    name: 'Local Business',
    slug: 'local',
    description: 'Community-focused, personal, trustworthy tone for local businesses',
    tone: 'community-focused, personal, trustworthy',
    styleGuide: 'Emphasize local connections. Reference the community by name. Be personal and genuine.',
    examples: [
      'Your neighborhood business is here for you! Stop by and say hi!',
      'Proudly serving our community for years. Thank you for your support!',
    ],
    isDefault: false,
    isGlobal: true,
  },
  {
    name: 'E-commerce Sales',
    slug: 'ecommerce',
    description: 'Promotional, urgency-driven, action-oriented tone for online stores',
    tone: 'promotional, urgency-driven, action-oriented',
    styleGuide: 'Create urgency with limited-time offers. Use strong calls to action. Highlight benefits.',
    examples: [
      'FLASH SALE: 50% off everything for the next 24 hours! Don\'t miss out!',
      'Your cart is waiting! Complete your order now and get free shipping.',
    ],
    isDefault: false,
    isGlobal: true,
  },
  {
    name: 'Educational',
    slug: 'educational',
    description: 'Informative, helpful, expert tone for educational content',
    tone: 'informative, helpful, expert',
    styleGuide: 'Provide value through education. Use clear explanations. Include tips and how-tos.',
    examples: [
      'Did you know? Here\'s a quick tip to help you achieve your goals.',
      'Let us break this down for you. Understanding the topic is easier than you think.',
    ],
    isDefault: false,
    isGlobal: true,
  },
  {
    name: 'Entertainment',
    slug: 'entertainment',
    description: 'Fun, humorous, engaging tone for entertainment brands',
    tone: 'fun, humorous, engaging',
    styleGuide: 'Be playful and lighthearted. Use humor appropriately. Create shareable content.',
    examples: [
      'You just discovered the best thing ever!',
      'Tag someone who needs to see this!',
    ],
    isDefault: false,
    isGlobal: true,
  },
  {
    name: 'Health & Wellness',
    slug: 'health-wellness',
    description: 'Calming, supportive, caring tone for health and wellness brands',
    tone: 'calming, supportive, caring',
    styleGuide: 'Use gentle, supportive language. Focus on well-being and self-care.',
    examples: [
      'Take a deep breath. You deserve this moment of peace.',
      'Your wellness journey matters. We\'re here to support you every step of the way.',
    ],
    isDefault: false,
    isGlobal: true,
  },
  {
    name: 'Luxury Premium',
    slug: 'luxury',
    description: 'Sophisticated, exclusive, aspirational tone for luxury brands',
    tone: 'sophisticated, exclusive, aspirational',
    styleGuide: 'Use elegant, refined language. Emphasize exclusivity and quality.',
    examples: [
      'Experience the art of craftsmanship. Where every detail matters.',
      'For those who appreciate the finer things. Introducing our latest collection.',
    ],
    isDefault: false,
    isGlobal: true,
  },
];

async function main() {
  console.log('Seeding global brand voices...');

  for (const voice of brandVoices) {
    await prisma.brandVoice.upsert({
      where: { slug: voice.slug },
      update: voice,
      create: voice,
    });
  }

  console.log(`Seeded ${brandVoices.length} global brand voices`);

  // Create demo tenant with default settings
  const demoTenant = await prisma.tenant.upsert({
    where: { id: 'demo-tenant' },
    update: {},
    create: {
      id: 'demo-tenant',
      name: 'Demo Company',
      slug: 'demo-company',
      settings: {},
    },
  });
  console.log(`Demo tenant ready: ${demoTenant.name}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
