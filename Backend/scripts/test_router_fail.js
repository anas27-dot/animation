const logger = console;

const detectChannelFromText = (q) => {
    if (!q || typeof q !== 'string') return null;
    const m = q.toLowerCase();
    if (m.includes('whatsapp') || m.includes("what'sapp") || m.includes('wa ')) return 'whatsapp';
    if (m.includes('email') || m.includes('mail') || m.includes('gmail')) return 'email';
    return null;
};

// Original Router Logic (Simplified replication of current chatService.js)
function testRouter(query, chatbot) {
    let forceToolStrategy = null;
    let toolChoice = 'auto';

    const detectedChannel = detectChannelFromText(query);
    console.log(`Detected Channel: ${detectedChannel}`);

    // Check Proposal Intent
    if (chatbot.settings?.intentEnabled && chatbot.settings?.proposal_condition) {
        const proposalCondition = chatbot.settings.proposal_condition;
        // BUG: matching full sentence against query
        if (query.toLowerCase().includes(proposalCondition.toLowerCase())) {
            forceToolStrategy = 'proposal';
        }
    }

    // Check Email Intent
    if (!forceToolStrategy && chatbot.settings?.email_intent?.enabled && chatbot.settings?.email_intent?.condition && detectedChannel !== 'whatsapp') {
        const emailCondition = chatbot.settings.email_intent.condition;
        // BUG: matching full sentence against query
        if (query.toLowerCase().includes(emailCondition.toLowerCase())) {
            forceToolStrategy = 'email';
        }
    }

    return { forceToolStrategy };
}

// REAL DB SETTINGS (Simulated)
const realSettings = {
    intentEnabled: true,
    proposal_condition: "User is asking for a proposal.",  // REAL VALUE
    intentKeywords: ["proposal", "quote", "pricing", "quotation", "estimate"], // REAL VALUE
    email_intent: {
        enabled: true,
        condition: "User is asking for a proposal." // REAL VALUE
    }
};

const scenarios = [
    {
        name: "Real DB: 'send me proposal on email'",
        query: "send me proposal on email",
        chatbot: { settings: realSettings }
    },
    {
        name: "Real DB: 'send me proposal' (General)",
        query: "send me proposal",
        chatbot: { settings: realSettings }
    }
];

scenarios.forEach(s => {
    console.log(`\n--- Scenario: ${s.name} ---`);
    const res = testRouter(s.query, s.chatbot);
    console.log("Result Strategy:", res.forceToolStrategy || "NULL (Failed)");
});
