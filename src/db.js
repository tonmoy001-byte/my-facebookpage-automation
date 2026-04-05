const fs = require('fs');
const path = require('path');

const DB_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DB_DIR, 'strikes.json');

// Ensure data directory and strike file exist
if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
}

if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({}, null, 2));
}

/**
 * Gets the current strike count for a user ID.
 * @param {string} userId - The Facebook PSID.
 * @returns {number} The current strike count.
 */
function getStrikes(userId) {
    const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    return data[userId] || 0;
}

/**
 * Increments the strike count for a user ID by 1.
 * @param {string} userId - The Facebook PSID.
 * @returns {number} The new strike count.
 */
function incrementStrike(userId) {
    const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    data[userId] = (data[userId] || 0) + 1;
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    return data[userId];
}

/**
 * Resets the strike count for a user ID to 0. (Useful for testing)
 * @param {string} userId - The Facebook PSID.
 */
function resetStrikes(userId) {
    const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    delete data[userId];
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

module.exports = {
    getStrikes,
    incrementStrike,
    resetStrikes
};
