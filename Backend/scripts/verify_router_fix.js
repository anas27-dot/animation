const logger = console;

const detectChannelFromText = (q) => {
    if (!q || typeof q !== 'string') return null;
    const m = q.toLowerCase();
    if (m.includes('whatsapp') || m.includes("what'sapp") || m.includes('wa ')) return 'whatsapp';
    if (m.includes('email') || m.includes('mail') || m.includes('gmail')) return 'email';
    return null;
};

// FIXED Router Logic (Matches chatService.js)
function testRouter(query, chatbot) {
    let forceToolStrategy = null;
    const detectedChannel = detectChannelFromText(query);
    console.log(`Detected Channel: ${detectedChannel}`);

    // Check Proposal Intent & Email Intent (Improved Router Logic)
    const keywords = chatbot.settings?.intentKeywords || [];
    const proposalCondition = chatbot.settings?.proposal_condition;
    const emailCondition = chatbot.settings?.email_intent?.condition;

    // A. Proposal Match (Keywords OR Condition)
    let isProposalMatch = false;
    if (chatbot.settings?.intentEnabled) {
        isProposalMatch = keywords.some(k => query.toLowerCase().includes(k.toLowerCase())) ||
            (proposalCondition && query.toLowerCase().includes(proposalCondition.toLowerCase()));
    }

    // B. Explicit Email Match (Channel 'email' + Action/Keywords)
    let isEmailExplicitMatch = false;
    if (chatbot.settings?.email_intent?.enabled && detectedChannel === 'email') {
        isEmailExplicitMatch = isProposalMatch ||
            query.toLowerCase().includes('send') ||
            query.toLowerCase().includes('share');
    }

    // C. Legacy Email Match (Condition string)
    let isEmailConditionMatch = false;
    if (chatbot.settings?.email_intent?.enabled && emailCondition && detectedChannel !== 'whatsapp') {
        isEmailConditionMatch = query.toLowerCase().includes(emailCondition.toLowerCase());
    }

    // Apply Strategy with Priority
    if (isEmailExplicitMatch) {
        forceToolStrategy = 'email';
    }
    else if (isProposalMatch) {
        forceToolStrategy = 'proposal';
    }
    else if (isEmailConditionMatch) {
        forceToolStrategy = 'email';
    }

    return { forceToolStrategy };
}

// REAL DB SETTINGS (Simulated)
const realSettings = {
    intentEnabled: true,
    proposal_condition: "User is asking for a proposal.",
    intentKeywords: ["proposal", "quote", "pricing", "quotation", "estimate"],
    email_intent: {
        enabled: true,
        condition: "User is asking for a proposal."
    }
};

const scenarios = [
    {
        name: "Real DB: 'send me proposal on email'",
        query: "send me proposal on email",
        chatbot: { settings: realSettings },
        expected: "email"
    },
    {
        name: "Real DB: 'send me proposal' (General)",
        query: "send me proposal",
        chatbot: { settings: realSettings },
        expected: "proposal"
    },
    {
        name: "Real DB: 'send me quote' (Keyword)",
        query: "send me quote",
        chatbot: { settings: realSettings },
        expected: "proposal"
    },
    {
        name: "Real DB: 'email me details' (No proposal keyword)",
        query: "email me details", // contains 'email' channel but no proposal keyword?
        // Wait, 'isEmailExplicitMatch' checks isProposalMatch || send || share.
        // 'email me details' contains 'email' -> detectedChannel='email'.
        // query contains 'email' but 'me details'.
        // Does NOT contain 'send' or 'share' or proposal keywords.
        // So might fail. Which is PROBABLY CORRECT (avoid over-triggering).
        // BUT 'email me' implies 'send email'.
        // Maybe I should add 'email' as a verb check? "email me"?
        // My code: includes('send') || includes('share').
        chatbot: { settings: realSettings },
        expected: null
    },
    {
        name: "Real DB: 'Send email' (Explicit)",
        query: "send email",
        chatbot: { settings: realSettings },
        expected: "email"
    }
];

scenarios.forEach(s => {
    console.log(`\n--- Scenario: ${s.name} ---`);
    const res = testRouter(s.query, s.chatbot);
    console.log(`Result: ${res.forceToolStrategy} | Expected: ${s.expected}`);
    if (res.forceToolStrategy !== s.expected && s.expected !== undefined) {
        console.error("❌ FAILED");
    } else {
        console.log("✅ PASSED");
    }
});
