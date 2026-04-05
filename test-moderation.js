const { checkCommentModeration, generateModerationWarning } = require('./src/ai');
const { getStrikes, resetStrikes, incrementStrike } = require('./src/db');

const testUserId = "test_user_psid_123";
const testUserName = "John Doe";

const testComments = [
    { text: "This page is fake and stupid!", expected: "TOXIC" },
    { text: "I hate this page, report the page now.", expected: "TOXIC" },
    { text: "Wow, I love these tech tips, thanks!", expected: "SAFE" }
];

async function runStrikeTest() {
    console.log("--- Refined Strike Logic Test Drive ---");
    
    // Reset strikes for a clean test
    resetStrikes(testUserId);
    console.log(`Initial Strikes for ${testUserId}: ${getStrikes(testUserId)}`);

    for (let i = 0; i < testComments.length; i++) {
        const comment = testComments[i];
        console.log(`\n--- Action ${i + 1} ---`);
        console.log(`Incoming Comment: "${comment.text}"`);
        
        const result = await checkCommentModeration(comment.text);
        
        if (result.isToxic) {
            const strikes = incrementStrike(testUserId);
            console.log(`🛑 TOXIC DETECTED. Category: ${result.category}. Reason: ${result.reason}`);
            console.log(`Current Strike Count: ${strikes}`);
            
            if (strikes >= 2) {
                console.log(`🚨 STRIKE 2 REACHED. 
                    - ACTION 1: DELETING COMMENT PERMANENTLY.
                    - ACTION 2: BANNING USER FROM PAGE.`);
            } else {
                console.log(`ℹ️ STRIKE 1.
                    - ACTION 1: HIDING COMMENT (Visible to author, invisible to public).`);
                
                const warningMsg = await generateModerationWarning(testUserName, result.category);
                console.log(`                    - ACTION 2: POSTING AI WARNING REPLY:
                      "${warningMsg}"`);
            }
        } else {
            console.log(`✅ SAFE COMMENT. Waiting 40 seconds to look natural... (Skipping delay for test)`);
            console.log(`ACTION: GENERATING CONTEXTUAL REPLY AND POSTING...`);
        }
    }
}

runStrikeTest();
