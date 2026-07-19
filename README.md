# FB AutoPost SaaS
<!-- trigger rebuild -->

A multi-tenant SaaS application for Facebook Page automation with AI-powered content generation, scheduling, and auto-reply capabilities.

## Features

- **AI Content Generation** - Generate engaging captions and hashtags using OpenRouter AI
- **Post Scheduling** - Schedule posts with calendar view and queue management
- **Auto-Reply Rules** - Automated comment responses with keyword, sentiment, and time-based rules
- **Analytics Dashboard** - Track engagement, impressions, and performance metrics
- **Multi-tenant Architecture** - Secure user isolation with encrypted credentials
- **Cloudinary Integration** - Image and video upload with optimization

## Tech Stack

- **Frontend:** Next.js 16 (App Router), TypeScript, Tailwind CSS
- **Backend:** Next.js API Routes, Prisma ORM, PostgreSQL
- **Authentication:** Custom JWT with bcryptjs
- **AI:** OpenRouter (Gemini 2.0 Flash)
- **File Storage:** Cloudinary
- **Email:** SendGrid
- **Deployment:** Vercel

## Prerequisites

- Node.js 18+ 
- PostgreSQL database
- Cloudinary account
- OpenRouter API key
- SendGrid account (optional)

## Environment Variables

Create a `.env` file in the root directory:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/fb_autopost"

# Authentication
JWT_SECRET="your-super-secret-jwt-key"

# OpenRouter AI
OPENROUTER_API_KEY="sk-or-v1-..."

# Cloudinary
CLOUDINARY_CLOUD_NAME="your-cloud-name"
CLOUDINARY_API_KEY="your-api-key"
CLOUDINARY_API_SECRET="your-api-secret"

# SendGrid (optional)
SENDGRID_API_KEY="SG...."
FROM_EMAIL="noreply@yourdomain.com"

# Facebook Webhook
WEBHOOK_VERIFY_TOKEN="your-verify-token"
CRON_SECRET="your-cron-secret"

# App URL
NEXT_PUBLIC_APP_URL="https://your-app.vercel.app"
```

## Setup Instructions

### 1. Clone and Install

```bash
git clone <repository-url>
cd fb-saas
npm install
```

### 2. Set Up Database

```bash
# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push

# Seed brand voice templates
npm run db:seed
```

### 3. Start Development Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

### 4. Connect Facebook Page

1. Go to Settings → Facebook
2. Enter your Facebook Page ID
3. Generate a Page Access Token from [Graph API Explorer](https://developers.facebook.com/tools/explorer/)
4. Paste the token and click Connect

### 5. Configure AI (Optional)

1. Get an API key from [OpenRouter](https://openrouter.ai/)
2. Add it to your `.env` file
3. Enable AI caption generation in post creation

## Deployment to Vercel

### 1. Push to GitHub

```bash
git add .
git commit -m "Initial commit"
git push origin main
```

### 2. Deploy to Vercel

1. Import your repository at [vercel.com/new](https://vercel.com/new)
2. Configure environment variables
3. Deploy

### 3. Set Up Database

For production, use a cloud PostgreSQL provider:

- [Neon](https://neon.tech/) (recommended)
- [Supabase](https://supabase.com/)
- [Railway](https://railway.app/)

Update `DATABASE_URL` in Vercel environment variables.

### 4. Configure Cron Jobs

The app uses Vercel Cron to process scheduled posts. The cron job runs every 5 minutes to check for due posts.

## API Endpoints

### Authentication
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Sign in
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/profile` - Update profile
- `PUT /api/auth/password` - Change password

### Posts
- `GET /api/posts` - List posts
- `POST /api/posts` - Create post
- `GET /api/posts/[id]` - Get post
- `PUT /api/posts/[id]` - Update post
- `DELETE /api/posts/[id]` - Delete post

### Scheduling
- `GET /api/schedule` - List scheduled posts
- `POST /api/schedule` - Create/update schedule
- `DELETE /api/schedule/[id]` - Remove from schedule
- `POST /api/schedule/process` - Process due posts (cron)

### Auto-Reply Rules
- `GET /api/rules` - List rules
- `POST /api/rules` - Create rule
- `GET /api/rules/[id]` - Get rule
- `PUT /api/rules/[id]` - Update rule
- `DELETE /api/rules/[id]` - Delete rule

### Analytics
- `GET /api/analytics` - Get analytics data
- `GET /api/analytics/summary` - Get summary stats
- `GET /api/analytics/top-posts` - Get top posts
- `GET /api/analytics/by-day` - Get engagement by day

### Facebook Integration
- `POST /api/facebook/connect` - Connect page
- `GET /api/facebook/pages` - List pages
- `DELETE /api/facebook/[pageId]` - Disconnect page
- `GET/POST /api/facebook/webhook` - Webhook handler

### AI
- `POST /api/ai/caption` - Generate caption
- `POST /api/ai/hashtags` - Suggest hashtags

### Upload
- `POST /api/upload` - Upload file to Cloudinary

## Testing

```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage
```

## License

MIT
