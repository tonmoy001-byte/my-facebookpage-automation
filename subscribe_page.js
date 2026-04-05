const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

const url = `https://graph.facebook.com/v19.0/${process.env.PAGE_ID}/subscribed_apps`;

console.log("Attempting to connect the Facebook Page directly to the App Webhook...");

axios.post(url, {
  subscribed_fields: 'feed',
  access_token: process.env.PAGE_ACCESS_TOKEN
})
.then(res => {
  if(res.data.success) {
    console.log("✅ SUCCESS! Your Facebook Page is now officially commanded to send comments to your Webhook!");
  } else {
    console.log(res.data);
  }
})
.catch(err => {
  console.error("❌ Failed to connect:", err.response ? err.response.data : err.message);
});
