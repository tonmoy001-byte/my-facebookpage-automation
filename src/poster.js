const { generateCaption } = require('./ai');
const { postToFeed, postPhoto, postMultiplePhotos } = require('./facebook');

/**
 * Automatically creates and publishes a Facebook post with AI generated captions.
 */
async function autoPost(topic, imageUrl = null) {
  try {
    console.log(`[AutoPoster] Starting post generation for topic: "${topic}"`);
    const caption = await generateCaption(topic);
    console.log(`[AutoPoster] AI Caption generated:\n${caption}`);
    if (imageUrl) {
      await postPhoto(imageUrl, caption);
    } else {
      await postToFeed(caption);
    }
    console.log('[AutoPoster] Success! Post is live.');
  } catch (error) {
    console.error('[AutoPoster] Critical failure in post cycle:', error.message);
    // In autoPost, we don't have a UI to show error, so we just log it.
  }
}

/**
 * Generates an AI caption draft for a given topic without posting.
 * @param {string} topic - The instructional topic for the AI.
 * @returns {Promise<string>} The generated caption.
 */
async function generateDraft(topic) {
  try {
    console.log(`[Draft] Generating caption for topic: "${topic}"`);
    const caption = await generateCaption(topic);
    return caption;
  } catch (error) {
    console.error('[Draft] Failed to generate AI caption after retries:', error.message);
    throw new Error('AI Caption generation failed. Please try again later or check your API quota.');
  }
}

/**
 * Publishes a previously approved draft to Facebook natively.
 * @param {string} caption - The exact text to post.
 * @param {string|string[]} [localFilePaths] - Absolute path(s) to the locally uploaded file(s).
 * @returns {Promise<Object>} Contains Facebook Post ID.
 */
async function publishDraft(caption, localFilePaths = null) {
  try {
    console.log(`[Publish] Attempting to publish approved draft...`);
    
    // Handle multiple photos
    if (Array.isArray(localFilePaths) && localFilePaths.length > 1) {
      return await postMultiplePhotos(localFilePaths, caption);
    }
    
    // Handle single photo (either inside array or as string)
    const singlePath = Array.isArray(localFilePaths) ? localFilePaths[0] : localFilePaths;
    
    if (singlePath) {
      return await postPhoto(singlePath, caption);
    } else {
      return await postToFeed(caption);
    }
  } catch (error) {
    console.error('[Publish] Failed to publish post:', error);
    throw error;
  }
}

module.exports = {
  autoPost,
  generateDraft,
  publishDraft
};
