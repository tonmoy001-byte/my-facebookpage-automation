INSERT INTO "BrandVoice" ("id", "name", "slug", "description", "tone", "styleGuide", "examples", "isDefault", "isGlobal", "isPreset", "createdAt", "updatedAt")
VALUES
  ('preset-professional', 'Professional', 'professional', 'Formal, authoritative tone for business communication', 'Formal, knowledgeable', 'Clear, authoritative language. No slang. Use industry expertise and credibility. Maintain a polished, respectful tone.', ARRAY['Discover the latest innovations in our field.', 'We are committed to delivering excellence.', 'Your trust drives our mission forward.'], false, true, true, NOW(), NOW()),

  ('preset-casual', 'Casual', 'casual', 'Friendly, relaxed tone for approachable brands', 'Friendly, relaxed', 'Conversational language. Emojis are OK. Be approachable and relatable. Write like you are talking to a friend.', ARRAY['Hey there! Check out what we have been up to.', 'Love this vibe? You are going to love what is next.', 'Thanks for being part of the journey!'], false, true, true, NOW(), NOW()),

  ('preset-funny', 'Funny', 'funny', 'Humorous, witty tone for entertaining content', 'Humorous, witty', 'Puns, wordplay, and lighthearted humor. Keep it fun but not forced. Avoid offensive jokes.', ARRAY['We did a thing. No regrets.', 'Plot twist: the product actually works.', 'Warning: side effects may include excessive smiling.'], false, true, true, NOW(), NOW()),

  ('preset-inspirational', 'Inspirational', 'inspirational', 'Uplifting, motivational tone for positive messaging', 'Uplifting, motivational', 'Positive language. Include a call-to-action. Focus on possibility and growth.', ARRAY['Every great journey starts with a single step.', 'Your potential is limitless. Let us explore it together.', 'Today is the day to make a change.'], false, true, true, NOW(), NOW()),

  ('preset-educational', 'Educational', 'educational', 'Informative, teaching tone for valuable content', 'Informative, teaching', 'Clear explanations. Step-by-step when possible. Provide value through knowledge.', ARRAY['Here is what you need to know about...', 'Pro tip: small changes make a big difference.', 'Let us break this down into simple steps.'], false, true, true, NOW(), NOW());
