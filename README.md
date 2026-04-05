You are an advanced AI automation developer. Your task is to build a complete Facebook Page automation system using JavaScript (Node.js) inside Antigravity.

## 🎯 Objective

Create an automation that:

1. Automatically posts content (image/video/text) to a Facebook Page
2. Generates human-like, emotional captions using AI
3. Reads and replies to user comments automatically in a natural, human tone

---

## ⚙️ Core Requirements

### 1. Facebook Integration

* Use Facebook Graph API
* Connect using Page Access Token
* Required permissions:

  * pages_manage_posts
  * pages_read_engagement
  * pages_manage_engagement

### 2. Auto Posting System

* Accept media input (image/video URL or file)

* Generate a caption using AI based on:

  * Product/service description
  * Target audience
  * Tone (emotional, friendly, promotional, etc.)

* Post using endpoint:

  * `/PAGE_ID/photos` (for images)
  * `/PAGE_ID/feed` (for text)

---

### 3. AI Caption Generator

* Use AI API (like OpenAI)
* Prompt style:

  * Write like a human (not robotic)
  * Add emotion, storytelling, and engagement
  * Include call-to-action when relevant

Example prompt:
"Write a friendly and emotional Facebook caption for [product]. Make it engaging and human-like."

---

### 4. Comment Monitoring (Webhook)

* Set up a webhook to listen for:

  * New comments on posts

* Extract:

  * Comment text
  * User name (if available)
  * Comment ID

---

### 5. Auto Reply System

* When a new comment arrives:

  * Send comment text to AI
  * Generate a human-like reply

Prompt example:
"Reply to this Facebook comment like a helpful human customer support agent: [comment]"

* Post reply using:

  * `/COMMENT_ID/comments`

---

## 🧠 Behavior Rules

* Always respond naturally (avoid robotic tone)
* Keep replies short, friendly, and helpful
* If user asks about price/order → guide them politely
* If unclear question → ask a follow-up question

---

## ❓ Clarification System (IMPORTANT)

If any required information is missing, you MUST ask the user before proceeding.

Ask questions like:

* What is your Facebook Page ID?
* Do you have a Page Access Token?
* What type of content will you post? (products, services, etc.)
* What tone do you want? (formal, casual, emotional)
* Do you want replies in one language or multiple?
* Do you have an AI API key?

Do NOT assume missing values.

---

## 🧩 Technical Stack

* Language: JavaScript (Node.js)
* HTTP requests: axios or fetch
* Webhook handling: Express.js
* Environment variables for secrets

---

## 🔐 Security

* Store tokens securely (env variables)
* Do not expose API keys in code

---

## 🚀 Output Expectation

* Clean and modular code
* Separate functions for:

  * Posting content
  * Generating captions
  * Handling webhook events
  * Replying to comments

---

## 🧠 Extra Intelligence (Optional)

* Detect sentiment of comments (positive/negative)
* Reply differently based on sentiment
* Avoid replying to spam comments

---

## 🚀 Getting Started

### 1. Installation

```bash
npm install
```

### 2. Configuration

Copy the `.env.example` file to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

### 3. Running Locally

Starts the server on http://localhost:3000

```bash
npm start
```

### 4. Webhook Setup

To test webhooks locally, use `ngrok`:

```bash
ngrok http 3000
```

Then configure your Facebook App with the ngrok URL: `https://<your-ngrok-id>.ngrok-free.app/webhook`

---

## 📦 Production Deployment

1. Set the `PORT` environment variable (defaults to 3000 if not set).
2. Ensure all environment variables from `.env.example` are configured in your hosting provider (e.g., Heroku, Vercel, DigitalOcean).
3. Run `npm start` to launch the production server.
