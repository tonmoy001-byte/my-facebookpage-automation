const { generateCommentReply, checkCommentModeration, generateModerationWarning } = require('./ai');
const { replyToComment, deleteComment, banUserFromPage, hideComment } = require('./facebook');
const { incrementStrike } = require('./db');

/**
 * Utility for artificial delay
 * @param {number} ms 
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Handles incoming POST requests from the Facebook webhook subscription.
 * Parses comments and triggers the AI auto-reply system.
 */
async function handleIncomingWebhook(req, res) {
  const body = req.body;

  // Ensure this is an event from a "page" subscription
  if (body.object === 'page') {
    // Acknowledge receipt to Facebook quickly to prevent retries
    res.status(200).send('EVENT_RECEIVED');

    for (const entry of body.entry) {
      if (!entry.changes) continue;
      
      for (const change of entry.changes) {
        if (change.field === 'feed') {
          const value = change.value;
          
          // We only want new comments being added
          if (value.item === 'comment' && value.verb === 'add') {
            const commentId = value.comment_id;
            const commentText = value.message;
            const senderId = value.from?.id;
            const senderName = value.from?.name || 'there';

            // CRITICAL: Don't reply to our own comments, otherwise it could loop
            if (senderId === process.env.PAGE_ID) {
              console.log('Skipping auto-reply for our own page comment.');
              continue;
            }
             
            console.log(`[Webhook] New comment from ${senderName}: "${commentText}"`);

            try {
              // 1. Moderate and Analyze the comment first
              const moderation = await checkCommentModeration(commentText);
              
              if (moderation.isToxic) {
                // Increment strike count for this user
                const strikes = incrementStrike(senderId);
                console.warn(`[Security] Toxic comment detected! Category: ${moderation.category}. User: ${senderName}. Strike: ${strikes}.`);
                
                if (strikes >= 2) {
                  // STRIKE 2+ : HARD REMOVAL & BAN
                  console.warn(`[Security] Repeat offender ${senderId}. Permanent Ban initiated.`);
                  await deleteComment(commentId);
                  await banUserFromPage(senderId);
                } else {
                  // STRIKE 1 : HIDE & WARNING REPLY
                  console.log(`[Security] 1st strike for ${senderName}. Hiding comment and issuing AI Warning.`);
                  
                  // Hide the comment from public view
                  await hideComment(commentId);
                  
                  // Generate specific AI warning
                  const warningMsg = await generateModerationWarning(senderName, moderation.category);
                  console.log(`[AI Warning] "${warningMsg}"`);
                  
                  // Post warning as a reply to the (now hidden) comment
                  await replyToComment(commentId, warningMsg);
                }
                
                continue; // Stop further processing for this comment
              }

              // 2. If safe, wait for the "Natural Delay" (40 seconds)
              console.log(`[Timer] Safe comment detected. Waiting 40 seconds to look natural...`);
              await sleep(40000); 

              // 3. Ask Gemini for an emotional, responsive contextual reply
              let aiReply;
              try {
                aiReply = await generateCommentReply(commentText, senderName);
                console.log(`[AI] Generated reply after delay: "${aiReply}"`);
              } catch (aiErr) {
                console.error('[AI] All retries failed for comment reply:', aiErr.message);
                aiReply = `Hi ${senderName}! Thanks for your comment. We've received your message and will get back to you shortly. 😊`;
              }
               
              // 4. Post the reply via Graph API
              await replyToComment(commentId, aiReply);
            } catch (error) {
              console.error('[System] Critical error processing comment flow.', error);
            }
          }
        }
      }
    }
  } else {
    res.sendStatus(404);
  }
}

module.exports = {
  handleIncomingWebhook
};
