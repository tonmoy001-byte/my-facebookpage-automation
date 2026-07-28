// @ts-nocheck
export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters?: {
      type: 'object';
      properties: Record<string, any>;
      required?: string[];
    };
  };
}

export const ASSISTANT_TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'generate_image',
      description: 'Generate an image from a text prompt using AI. Use this when the user wants to create a visual for their post.',
      parameters: {
        type: 'object',
        properties: {
          prompt: {
            type: 'string',
            description: 'Detailed description of the image to generate. Be specific about style, colors, composition.',
          },
          aspect_ratio: {
            type: 'string',
            enum: ['1:1', '16:9', '9:16', '4:3', '3:4'],
            description: 'Image aspect ratio. Default is 1:1 for Facebook posts.',
          },
        },
        required: ['prompt'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_caption',
      description: 'Generate a Facebook post caption with hashtags based on a description.',
      parameters: {
        type: 'object',
        properties: {
          description: {
            type: 'string',
            description: 'What the post is about',
          },
          language: {
            type: 'string',
            enum: ['EN', 'BN'],
            description: 'Language for the caption',
          },
          brand_voice_id: {
            type: 'string',
            description: 'ID of the brand voice to use (omit for default)',
          },
          include_hashtags: {
            type: 'boolean',
            description: 'Whether to include hashtags (default true)',
          },
        },
        required: ['description'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_post',
      description: 'Create a Facebook post. Can be a draft or scheduled for later.',
      parameters: {
        type: 'object',
        properties: {
          caption: {
            type: 'string',
            description: 'The post caption/text',
          },
          hashtags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Hashtags without # prefix',
          },
          image_url: {
            type: 'string',
            description: 'URL of the image to include (from generate_image or upload)',
          },
          scheduled_at: {
            type: 'string',
            description: 'ISO 8601 datetime to schedule the post. Omit for draft.',
          },
          brand_voice_id: {
            type: 'string',
            description: 'Brand voice ID to associate with the post',
          },
          language: {
            type: 'string',
            enum: ['EN', 'BN'],
            description: 'Post language',
          },
          auto_reply: {
            type: 'boolean',
            description: 'Enable auto-reply for comments on this post',
          },
        },
        required: ['caption'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'publish_now',
      description: 'Immediately publish a post to the connected Facebook page.',
      parameters: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            description: 'The post text to publish',
          },
          image_url: {
            type: 'string',
            description: 'Optional image URL to include',
          },
        },
        required: ['message'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_analytics',
      description: 'Get page analytics summary including total posts, engagement, reach, and top performing posts.',
      parameters: {
        type: 'object',
        properties: {
          days: {
            type: 'number',
            description: 'Number of days to look back (default 30)',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_comments',
      description: 'Get recent comments on Facebook posts. Can filter by status.',
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['PROCESSING', 'REPLIED', 'PENDING', 'ESCALATED', 'FAILED'],
            description: 'Filter by comment status',
          },
          limit: {
            type: 'number',
            description: 'Max comments to return (default 10)',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'reply_to_comment',
      description: 'Reply to a specific comment on a Facebook post.',
      parameters: {
        type: 'object',
        properties: {
          comment_id: {
            type: 'string',
            description: 'The comment ID to reply to',
          },
          reply_text: {
            type: 'string',
            description: 'The reply text',
          },
        },
        required: ['comment_id', 'reply_text'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_rules',
      description: 'List all auto-reply rules configured for the page.',
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_rule',
      description: 'Create a new auto-reply rule for incoming comments.',
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Rule name',
          },
          type: {
            type: 'string',
            enum: ['keyword', 'sentiment', 'time'],
            description: 'Rule type',
          },
          keywords: {
            type: 'array',
            items: { type: 'string' },
            description: 'Keywords to match (for keyword rules)',
          },
          sentiment: {
            type: 'string',
            enum: ['positive', 'negative', 'neutral'],
            description: 'Sentiment to match (for sentiment rules)',
          },
          reply_template: {
            type: 'string',
            description: 'Template reply text. Use {name}, {comment}, {postTitle}, {pageName} as variables.',
          },
          action: {
            type: 'string',
            enum: ['reply', 'ai_reply', 'escalate'],
            description: 'What to do when rule matches',
          },
          priority: {
            type: 'number',
            description: 'Rule priority (higher = checked first)',
          },
        },
        required: ['name', 'type'],
      },
    },
  },
];
