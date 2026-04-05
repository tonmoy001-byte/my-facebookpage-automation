const axios = require('axios');
const dotenv = require('dotenv');
const FormData = require('form-data');
const fs = require('fs');
dotenv.config();

const PAGE_ID = process.env.PAGE_ID;
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const GRAPH_API_VER = 'v19.0';
const BASE_URL = `https://graph.facebook.com/${GRAPH_API_VER}`;

/**
 * Validates the Facebook webhook verification challenge.
 */
function verifyWebhook(req, res) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN) {
      console.log('WEBHOOK_VERIFIED');
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  } else {
    res.sendStatus(400);
  }
}

/**
 * Posts text content to the Facebook Page feed.
 */
async function postToFeed(message) {
  try {
    const url = `${BASE_URL}/${PAGE_ID}/feed`;
    const response = await axios.post(url, {
      message: message,
      access_token: PAGE_ACCESS_TOKEN,
    });
    console.log(`Successfully posted text to feed: ${response.data.id}`);
    return response.data;
  } catch (error) {
    console.error('Error posting to feed:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Posts an image to the Facebook Page natively using multipart form data.
 * @param {string} imagePath - Absolute local path to the uploaded image.
 * @param {string} caption - The caption for the photo.
 */
async function postPhoto(imagePath, caption) {
  try {
    const url = `${BASE_URL}/${PAGE_ID}/photos`;
    
    // Facebook API requires multipart/form-data when using the dynamic 'source' attribute!
    const form = new FormData();
    form.append('message', caption);
    form.append('access_token', PAGE_ACCESS_TOKEN);
    form.append('source', fs.createReadStream(imagePath));

    const response = await axios.post(url, form, {
      headers: {
        ...form.getHeaders() // Inject strict multipart boundaries from form-data library
      }
    });

    console.log(`Successfully posted native photo block: ${response.data.id}`);
    return response.data;
  } catch (error) {
    console.error('Error posting photo:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Uploads a photo to Facebook but does NOT publish it yet.
 * Returns the photo ID for use in 'attached_media'.
 */
async function uploadUnpublishedPhoto(imagePath) {
  try {
    const url = `${BASE_URL}/${PAGE_ID}/photos`;
    const form = new FormData();
    form.append('access_token', PAGE_ACCESS_TOKEN);
    form.append('published', 'false'); // CRITICAL: This prevents automatic single-photo posting!
    form.append('source', fs.createReadStream(imagePath));

    const response = await axios.post(url, form, {
      headers: { ...form.getHeaders() }
    });

    console.log(`[Facebook] Uploaded unpublished photo: ${response.data.id}`);
    return response.data.id;
  } catch (error) {
    console.error('[Facebook] Error uploading unpublished photo:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Creates a single post on the feed containing multiple photos.
 */
async function postMultiplePhotos(imagePaths, caption) {
  try {
    console.log(`[Facebook] Starting multi-photo post for ${imagePaths.length} photos...`);
    
    // 1. Upload all photos sequentially as unpublished
    const mediaIds = [];
    for (const path of imagePaths) {
      const photoId = await uploadUnpublishedPhoto(path);
      mediaIds.push(photoId);
    }

    // 2. Attach them all to a single feed post
    const url = `${BASE_URL}/${PAGE_ID}/feed`;
    const attachedMedia = mediaIds.map(id => ({ media_fbid: id }));
    
    const response = await axios.post(url, {
      message: caption,
      attached_media: attachedMedia,
      access_token: PAGE_ACCESS_TOKEN,
    });

    console.log(`[Facebook] Multi-photo post live: ${response.data.id}`);
    return response.data;
  } catch (error) {
    console.error('[Facebook] Error posting multiple photos:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Replies dynamically to a visitor's comment.
 */
async function replyToComment(commentId, replyMessage) {
  try {
    const url = `${BASE_URL}/${commentId}/comments`;
    const response = await axios.post(url, {
      message: replyMessage,
      access_token: PAGE_ACCESS_TOKEN,
    });
    console.log(`Successfully replied to comment ${commentId}: ${response.data.id}`);
    return response.data;
  } catch (error) {
    console.error(`Error replying to comment ${commentId}:`, error.response?.data || error.message);
    throw error;
  }
}

/**
 * Deletes a comment from the Facebook Page.
 * @param {string} commentId - The ID of the comment to delete.
 */
async function deleteComment(commentId) {
  try {
    const url = `${BASE_URL}/${commentId}`;
    const response = await axios.delete(url, {
      params: { access_token: PAGE_ACCESS_TOKEN }
    });
    console.log(`[Facebook] Successfully deleted comment ${commentId}`);
    return response.data;
  } catch (error) {
    console.error(`[Facebook] Error deleting comment ${commentId}:`, error.response?.data || error.message);
    throw error;
  }
}

/**
 * Bans a user from the Facebook Page.
 * @param {string} userId - The Page-scoped User ID (PSID) to block.
 */
async function banUserFromPage(userId) {
  try {
    const url = `${BASE_URL}/${PAGE_ID}/blocked`;
    const response = await axios.post(url, {
      user: userId,
      access_token: PAGE_ACCESS_TOKEN
    });
    console.log(`[Facebook] Successfully banned user ${userId}`);
    return response.data;
  } catch (error) {
    console.error(`[Facebook] Error banning user ${userId}:`, error.response?.data || error.message);
    throw error;
  }
}

/**
 * Hides a comment on the Facebook Page (invisible to public, visible to author).
 * @param {string} commentId - The ID of the comment to hide.
 */
async function hideComment(commentId) {
  try {
    const url = `${BASE_URL}/${commentId}`;
    const response = await axios.post(url, {
      is_hidden: true,
      access_token: PAGE_ACCESS_TOKEN
    });
    console.log(`[Facebook] Successfully hidden comment ${commentId}`);
    return response.data;
  } catch (error) {
    console.error(`[Facebook] Error hiding comment ${commentId}:`, error.response?.data || error.message);
    throw error;
  }
}

module.exports = {
  verifyWebhook,
  postToFeed,
  postPhoto,
  uploadUnpublishedPhoto,
  postMultiplePhotos,
  replyToComment,
  deleteComment,
  banUserFromPage,
  hideComment
};
