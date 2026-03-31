const logger = console;

const detectChannelFromText = (q) => {
    if (!q || typeof q !== 'string') return null;
    const m = q.toLowerCase();
    if (m.includes('whatsapp') || m.includes("what'sapp") || m.includes('wa ')) return 'whatsapp';
    if (m.includes('email') || m.includes('mail') || m.includes('gmail')) return 'email';
    return null;
};

function testRouter(query, chatbot) {
    let forceToolStrategy = null;
    let toolChoice = 'auto';
    let fillerText = null;

    const detectedChannel = detectChannelFromText(query);
    console.log(`Detected Channel: ${detectedChannel}`);

    // Check Proposal Intent
    if (chatbot.settings?.intentEnabled && chatbot.settings?.proposal_condition) {
        const proposalCondition = chatbot.settings.proposal_condition;
        if (query.toLowerCase().includes(proposalCondition.toLowerCase())) {
            forceToolStrategy = 'proposal';
            toolChoice = { type: 'function', function: { name: 'check_proposal_intent' } };
            fillerText = "Checking proposal details...";
            logger.info(`🎯 [Router] Force Strategy: PROPOSAL. Condition matched: "${proposalCondition}"`);
        }
    }

    // Check Email Intent
    if (!forceToolStrategy && chatbot.settings?.email_intent?.enabled && chatbot.settings?.email_intent?.condition && detectedChannel !== 'whatsapp') {
        const emailCondition = chatbot.settings.email_intent.condition;
        if (query.toLowerCase().includes(emailCondition.toLowerCase())) {
            forceToolStrategy = 'email';
            toolChoice = { type: 'function', function: { name: 'check_email_intent' } };
            fillerText = "Checking email options...";
            logger.info(`🎯 [Router] Force Strategy: EMAIL. Condition matched: "${emailCondition}"`);
        }
    }

    // Check Calling Intent
    if (!forceToolStrategy && chatbot.settings?.calling_tool?.enabled && chatbot.settings?.calling_tool?.condition) {
        const callingCondition = chatbot.settings.calling_tool.condition;
        if (query.toLowerCase().includes(callingCondition.toLowerCase())) {
            forceToolStrategy = 'calling';
            toolChoice = { type: 'function', function: { name: 'check_calling_intent' } };
            fillerText = "Checking calling availability...";
            logger.info(`🎯 [Router] Force Strategy: CALLING. Condition matched: "${callingCondition}"`);
        }
    }

    return { forceToolStrategy, toolChoice, fillerText };
}

const scenarios = [
    {
        name: "1. Proposal on Email (All Enabled)",
        query: "send me proposal on email",
        chatbot: {
            settings: {
                intentEnabled: true,
                proposal_condition: "proposal",
                email_intent: { enabled: true, condition: "email" }
            }
        }
    },
    {
        name: "2. Proposal on Email (intentEnabled MISSING)",
        query: "send me proposal on email",
        chatbot: {
            settings: {
                // intentEnabled is missing
                proposal_condition: "proposal",
                email_intent: { enabled: true, condition: "email" }
            }
        }
    },
    {
        name: "3. Proposal on Email (All Disabled)",
        query: "send me proposal on email",
        chatbot: {
            settings: {
                intentEnabled: false,
                proposal_condition: "proposal",
                email_intent: { enabled: false, condition: "email" }
            }
        }
    },
    {
        name: "4. Proposal on Email (WhatsApp detected - Conflict check)",
        query: "send me proposal on email via whatsapp",
        chatbot: {
            settings: {
                intentEnabled: false, // Force Proposal fail to test Email logic
                proposal_condition: "proposal",
                email_intent: { enabled: true, condition: "email" }
            }
        }
    }
];

scenarios.forEach(s => {
    console.log(`\n--- Scenario: ${s.name} ---`);
    const res = testRouter(s.query, s.chatbot);
    console.log("Result Strategy:", res.forceToolStrategy);
});
