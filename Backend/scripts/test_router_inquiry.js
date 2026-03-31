const logger = console;

const detectChannelFromText = (q) => {
    if (!q || typeof q !== 'string') return null;
    const m = q.toLowerCase();
    if (m.includes('whatsapp') || m.includes("what'sapp") || m.includes('wa ')) return 'whatsapp';
    if (m.includes('email') || m.includes('mail') || m.includes('gmail')) return 'email';
    return null;
};

// PROPOSED Router Logic
function testRouter(query, chatbot) {
    let forceToolStrategy = null;
    const detectedChannel = detectChannelFromText(query);
    console.log(`Query: "${query}" | Channel: ${detectedChannel}`);

    // Keywords
    const keywords = chatbot.settings?.intentKeywords || [];
    const proposalCondition = chatbot.settings?.proposal_condition;
    const emailCondition = chatbot.settings?.email_intent?.condition;

    // Helper Regex
    // Inquiry: what, why, how, tell me, explain, who, when
    const inquiryRegex = /^(what|why|how|tell me|explain|who|when|where|does)/i;

    // Action: send, share, give, mail, email, whatsapp, forward, get, provide
    // We check this to override inquiry (e.g. "how can I get")
    const actionRegex = /(send|share|give|mail|email|whatsapp|forward|get|provide)/i;

    const isInquiry = inquiryRegex.test(query);
    const isAction = actionRegex.test(query);

    console.log(`  -> isInquiry: ${isInquiry}, isAction: ${isAction}`);

    // A. Proposal Match
    let isProposalMatch = false;
    if (chatbot.settings?.intentEnabled) {
        const hasKeyword = keywords.some(k => query.toLowerCase().includes(k.toLowerCase())) ||
            (proposalCondition && query.toLowerCase().includes(proposalCondition.toLowerCase()));

        if (hasKeyword) {
            if (isAction) {
                isProposalMatch = true; // Keyword + Action = Force
            } else if (isInquiry) {
                isProposalMatch = false; // Keyword + Inquiry (No Action) = Don't Force (Let RAG answer)
            } else {
                isProposalMatch = true; // Keyword + Ambiguous (e.g. "Proposal") = Force (Default)
            }
        }
    }

    // B. Explicit Email Match
    let isEmailExplicitMatch = false;
    if (chatbot.settings?.email_intent?.enabled && detectedChannel === 'email') {
        isEmailExplicitMatch = isProposalMatch ||
            query.toLowerCase().includes('send') ||
            query.toLowerCase().includes('share');
    }

    // C. Legacy Email Match (Condition string)
    let isEmailConditionMatch = false;
    if (chatbot.settings?.email_intent?.enabled && emailCondition && detectedChannel !== 'whatsapp') {
        // Apply same Inquiry logic? 
        // If condition matches "User wants email", it implies action.
        // But if query is "how does email work?", we shouldn't trigger.
        const matchesCondition = query.toLowerCase().includes(emailCondition.toLowerCase());
        if (matchesCondition) {
            if (isInquiry && !isAction) isEmailConditionMatch = false;
            else isEmailConditionMatch = true;
        }
    }

    // Apply Strategy
    if (isEmailExplicitMatch) forceToolStrategy = 'email';
    else if (isProposalMatch) forceToolStrategy = 'proposal';
    else if (isEmailConditionMatch) forceToolStrategy = 'email';

    return { forceToolStrategy };
}

// Settings
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
    { q: "what is proposal of calling agent", expected: null }, // Inquiry -> RAG
    { q: "send me proposal", expected: "proposal" }, // Action -> Force
    { q: "how do I get proposal", expected: "proposal" }, // Inquiry + Action ("get") -> Force
    { q: "proposal", expected: "proposal" }, // Ambiguous -> Force
    { q: "tell me about pricing", expected: null }, // Inquiry -> RAG
    { q: "give me quote", expected: "proposal" }, // Action -> Force
    { q: "send proposal on email", expected: "email" }, // Explicit Email
    { q: "what is the email address", expected: null } // Inquiry (contains email) -> RAG
];

scenarios.forEach(s => {
    const res = testRouter(s.q, { settings: realSettings });
    const pas = res.forceToolStrategy === s.expected;
    console.log(`  => Result: ${res.forceToolStrategy} [${pas ? 'PASS' : 'FAIL'}]\n`);
});
