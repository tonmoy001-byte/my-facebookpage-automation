const dotenv = require('dotenv');
dotenv.config();

// Config
const TONE = 'casual, emotional, friendly, and very concise';
const CONTENT_STYLE = 'tech products, digital services, some tips and trick type post';
const LANGUAGES = 'dynamically handle multiple languages (reply in the language of the user)';

let openrouter = null;

/**
 * Lazy-load OpenRouter SDK (since it's an ES Module)
 */
async function getClient() {
  if (!openrouter) {
    try {
      const { OpenRouter } = await import('@openrouter/sdk');
      openrouter = new OpenRouter({
        apiKey: process.env.OPENROUTER_API_KEY || 'dummy_key',
        defaultHeaders: {
          "HTTP-Referer": "https://antigravity.ai",
          "X-OpenRouter-Title": "Facebook Automation Native",
        }
      });
    } catch (err) {
      console.error('[AI] Failed to initialize OpenRouter SDK:', err.message);
      throw err;
    }
  }
  return openrouter;
}

const modelName = process.env.AI_MODEL || 'qwen/qwen-3.6-plus';

/**
 * Utility for artificial delay with jitter
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms + Math.random() * 500));

/**
 * Global retry wrapper for AI calls to handle rate limits and transient errors.
 */
async function callWithRetry(fn, args, retries = 3, delay = 2000) {
  try {
    return await fn(...args);
  } catch (error) {
    const isRateLimit = error.status === 429 || (error.message && error.message.includes('429'));
    const isServerError = error.status >= 500 || (error.message && error.message.includes('500'));
    
    if ((isRateLimit || isServerError) && retries > 0) {
      console.warn(`[AI] Error ${error.status || 'unknown'}. Retrying in ${delay/1000}s... (${retries} attempts left)`);
      await sleep(delay);
      return callWithRetry(fn, args, retries - 1, delay * 2); // Exponential backoff
    }
    throw error;
  }
}

/**
 * Generates an emotional and human-like caption for a Facebook post.
 */
async function generateCaption(topic) {
  const prompt = `
You are an expert social media manager managing a Facebook Page.
Your tone must be: ${TONE}.
The content is mainly about: ${CONTENT_STYLE}.

Write a short, engaging, and human-like Facebook caption about: "${topic}".
Do not sound robotic. Add emotion, storytelling, and engagement.
Include relevant emojis and a call to action if appropriate.
Just return the caption text without quotes or preamble.
  `;

  return callWithRetry(async () => {
    const client = await getClient();
    const response = await client.chat.send({
      chatRequest: {
        model: modelName,
        messages: [{ role: 'user', content: prompt }],
      }
    });
    return response.choices[0].message.content.trim();
  }, []);
}

/**
 * Generates a human-like reply to a Facebook comment.
 */
async function generateCommentReply(commentText, userName = 'there') {
  const prompt = `
You are a friendly, human-like customer support agent for a Facebook Page.
Your tone must be: ${TONE}.
The page is about: ${CONTENT_STYLE}.
CRITICAL RULE: ${LANGUAGES}. Detect the language of the user's comment and reply in that EXACT same language natively.

A user named ${userName} commented on a post: "${commentText}"

Reply to this comment naturally. 
CRITICAL: Keep it extremely short (under 15 words) and concise.
If they ask about price/order, politely guide them to check out your page/store.
If it's an unclear question, ask a short follow-up question.
Do NOT sound robotic.
Just return the reply text without quotes or preamble.
  `;

  return callWithRetry(async () => {
    const client = await getClient();
    const response = await client.chat.send({
      chatRequest: {
        model: modelName,
        messages: [{ role: 'user', content: prompt }],
      }
    });
    return response.choices[0].message.content.trim();
  }, []);
}

/**
 * Robust JSON extraction from AI response.
 */
function extractJson(text) {
  if (!text) throw new Error('Empty AI response');
  
  try {
    const mdMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    if (mdMatch) return JSON.parse(mdMatch[1]);

    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    
    return JSON.parse(text);
  } catch (e) {
    console.error('[AI] Failed to parse JSON from text:', text);
    throw new Error('Invalid AI response format: ' + e.message);
  }
}

/**
 * Checks if a comment is toxic and categorizes the violation.
 */
async function checkCommentModeration(commentText) {
  const prompt = `
You are a senior content moderator for a high-priority Facebook Page. 
Analyze the following comment and return a JSON object.

Toxicity Criteria:
- Direct insults (e.g., "stupid", "idiot").
- Negativity toward the page/business (e.g., "this page is fake", "I hate this page", "don't buy anything", "scam").
- Calls to report the page (e.g., "report the page", "let's report this").
- Hate speech or vulgarity.
- Obvious spam/scams.

Comment: "${commentText}"

Return JSON only:
{
  "isToxic": true/false,
  "category": "Hate Speech" | "Personal Insult" | "Business Negativity" | "Spam" | "Safe",
  "reason": "Short explanation of why it was flagged"
}
  `;

  try {
    const rawResponse = await callWithRetry(async () => {
      const client = await getClient();
      const response = await client.chat.send({
        chatRequest: {
          model: modelName,
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' }
        }
      });
      return response.choices[0].message.content;
    }, []);
    
    const result = extractJson(rawResponse);
    console.log(`[Moderation] AI Analysis:`, result);
    return result;
  } catch (error) {
    console.error('Error in AI moderation check:', error.message);
    return { isToxic: false, category: "Safe", reason: "AI Moderation service unavailable." };
  }
}

/**
 * Generates a firm but professional warning reply tagging the user.
 */
async function generateModerationWarning(userName, category) {
  const prompt = `
Write a short, firm, and professional moderation warning for a Facebook user named ${userName}.
The user just posted a comment flagged as: ${category}.

Requirements:
- Be polite but very strict.
- Mention that their comment was hidden/removed because it violates community standards.
- Warn them that a second violation will result in a permanent ban from the page.
- Do not use quotes or preamble.
  `;

  try {
    const warningText = await callWithRetry(async () => {
      const client = await getClient();
      const response = await client.chat.send({
        chatRequest: {
          model: modelName,
          messages: [{ role: 'user', content: prompt }],
        }
      });
      return response.choices[0].message.content.trim();
    }, []);
    return warningText;
  } catch (error) {
    console.error('Error generating warning response:', error);
    return `Hello ${userName}, your comment has been hidden as it violates our community guidelines. Please follow our rules to avoid being banned.`;
  }
}

module.exports = {
  generateCaption,
  generateCommentReply,
  checkCommentModeration,
  generateModerationWarning
};
