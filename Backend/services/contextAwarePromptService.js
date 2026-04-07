const logger = require('../config/logging');
const { retrieveUserContext } = require('./memoryService');
const PhoneUser = require('../models/PhoneUser');

/**
 * Extract memories from conversation history (Short Term)
 */
function extractMemories(conversationHistory = []) {
  const memories = [];
  const seenFacts = new Set();

  for (const msg of conversationHistory) {
    if (msg.role === 'user') {
      const content = msg.content.toLowerCase();
      // Extract name
      if (content.includes('my name is') || content.includes('i am') || content.includes('this is')) {
        const nameMatch = msg.content.match(/(?:my name is|i am|this is|i'm)\s+([a-z]+(?:\s+[a-z]+)?)/i);
        if (nameMatch && !seenFacts.has('name')) {
          memories.push(`[NAME]: ${nameMatch[1]}`);
          seenFacts.add('name');
        }
      }
      // Extract phone/email
      const emailMatch = msg.content.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
      if (emailMatch && !seenFacts.has('email')) {
        memories.push(`[EMAIL]: ${emailMatch[0]}`);
        seenFacts.add('email');
      }
      const phoneMatch = msg.content.match(/(?:\+?\d{1,4}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
      if (phoneMatch && !seenFacts.has('phone')) {
        memories.push(`[PHONE]: ${phoneMatch[0]}`);
        seenFacts.add('phone');
      }
      // Extract requirements
      if (content.includes('i need') || content.includes('i want') || content.includes('looking for') ||
        content.includes('i require') || content.includes('interested in')) {
        const fact = `[REQ]: ${msg.content.substring(0, 100)}`;
        if (!seenFacts.has(fact)) {
          memories.push(fact);
          seenFacts.add(fact);
        }
      }
    }
  }
  return memories.slice(-20);
}

function hasGreetingBeenUsed(conversationHistory = []) {
  const greetingPatterns = [
    /^(good\s+(morning|afternoon|evening|night))/i,
    /^(hello|hi|hey|greetings|good\s+day)/i,
    /^(namaste|namaskar)/i,
  ];
  for (const msg of conversationHistory) {
    if (msg.role === 'assistant' && msg.content) {
      const content = msg.content.trim();
      for (const pattern of greetingPatterns) {
        if (pattern.test(content)) return true;
      }
    }
  }
  return false;
}

/**
 * 🧠 NAME LOGIC: Controls frequency of name usage
 */
function getNameUsagePermissions(conversationHistory, userName) {
  if (!userName) return { allowed: false, reason: "No name known" };
  const MAX_USAGE_PER_SESSION = 6;
  const SPACING_BUFFER = 2;
  const PROBABILITY = 0.8;

  let usageCount = 0;
  let turnsSinceLastUse = 99;

  let assistantMsgIndex = 0;
  for (let i = conversationHistory.length - 1; i >= 0; i--) {
    const msg = conversationHistory[i];
    if (msg.role === 'assistant') {
      if (msg.content && msg.content.toLowerCase().includes(userName.toLowerCase())) {
        usageCount++;
        if (turnsSinceLastUse === 99) turnsSinceLastUse = assistantMsgIndex;
      }
      assistantMsgIndex++;
    }
  }

  if (usageCount >= MAX_USAGE_PER_SESSION) return { allowed: false, reason: "Max limit reached" };
  if (turnsSinceLastUse < SPACING_BUFFER) return { allowed: false, reason: "Used too recently" };
  if (Math.random() > PROBABILITY) return { allowed: false, reason: "Randomizer block" };

  return { allowed: true, reason: "Allowed" };
}

/**
 * Build comprehensive multi-layered system prompt
 */
async function buildPrompt({
  persona,
  knowledgeBase = [],
  conversationHistory = [],
  timeContext = null,
  query = '',
  intent = 'general_query',
  toolInstructions = null,
  detectedLanguageObj = null,
  userId = null,    // Passed from Routes
  chatbotId = null, // Passed from Routes
  phone = null     // Phone = identity anchor for device-agnostic memory retrieval
}) {
  try {
    const config = {
      persona: persona || 'You are a helpful assistant.',
      salesGoal: null,
    };

    //     // Extract company name from persona and knowledge base
    //     let companyName = 'Troika Tech Services'; // Default fallback

    //     // Try to extract from persona first
    //     if (persona) {
    //       // Look for common patterns in persona text
    //       const personaText = persona.toLowerCase();

    //       // Look for explicit company mentions
    //       const companyPatterns = [
    //         /(?:representing|working for|from|at|with)\s+([A-Za-z][A-Za-z\s&]+(?:Tech|Services|Solutions|Labs|Inc|LLC|Corporation|Company|Ltd|Limited)?)/i,
    //         /(?:company|organization|business)\s+(?:is|called|named)\s+([A-Za-z][A-Za-z\s&]+(?:Tech|Services|Solutions|Labs|Inc|LLC|Corporation|Company|Ltd|Limited)?)/i,
    //         /([A-Za-z][A-Za-z\s&]+(?:Tech|Services|Solutions|Labs|Inc|LLC|Corporation|Company|Ltd|Limited))/i
    //       ];

    //       for (const pattern of companyPatterns) {
    //         const match = personaText.match(pattern);
    //         if (match && match[1] && match[1].length > 3 && match[1].length < 50) {
    //           companyName = match[1].trim();
    //           break;
    //         }
    //       }
    //     }

    //     // If not found in persona, try knowledge base
    //     if (companyName === 'Troika Tech Services' && knowledgeBase && knowledgeBase.length > 0) {
    //       for (const chunk of knowledgeBase) {
    //         if (chunk.content) {
    //           const contentText = chunk.content.toLowerCase();

    //           // Look for company patterns in knowledge base
    //           const kbPatterns = [
    //             /(?:our company|our business|we are|we're)\s+([A-Za-z][A-Za-z\s&]+(?:Tech|Services|Solutions|Labs|Inc|LLC|Corporation|Company|Ltd|Limited)?)/i,
    //             /(?:company|organization)\s+(?:name|is)\s+([A-Za-z][A-Za-z\s&]+(?:Tech|Services|Solutions|Labs|Inc|LLC|Corporation|Company|Ltd|Limited)?)/i
    //           ];

    //           for (const pattern of kbPatterns) {
    //             const match = contentText.match(pattern);
    //             if (match && match[1] && match[1].length > 3 && match[1].length < 50) {
    //               companyName = match[1].trim();
    //               break;
    //             }
    //           }
    //           if (companyName !== 'Troika Tech Services') break;
    //         }
    //       }
    //     }

    // 1. SETUP TIME & GREETING VARS
    // timeContext is passed as an object { text, greeting } from generateStreamingAnswer
    let timeString = '';
    let greetingPhrase = 'Hello';

    if (timeContext && typeof timeContext === 'object') {
      timeString = timeContext.text;
      greetingPhrase = timeContext.greeting;
    } else if (typeof timeContext === 'string') {
      timeString = timeContext; // Fallback if string passed
    }

    const knowledgeFiles = knowledgeBase
      .filter(chunk => chunk && chunk.content && chunk.content.trim().length > 0)
      .map((chunk, index) => ({
        name: chunk.metadata?.source || chunk.metadata?.title || `Chunk ${index + 1}`,
        content: chunk.content || '',
      }));

    if (knowledgeFiles.length === 0 && knowledgeBase.length > 0) {
      logger.warn(`Knowledge base provided but all chunks were empty or invalid`);
    }

    // 2. FETCH LONG-TERM MEMORY (MongoDB + PhoneUser fallback)
    let userMemoryContext = '';
    let knownUserName = null;
    let knownBusiness = null;

    if (userId && query && userId !== 'guest' && !userId.startsWith('guest_')) {
      try {
        // 🚀 CRITICAL: Long-term facts from MongoDB (phone = identity anchor)
        userMemoryContext = await retrieveUserContext(userId, query, chatbotId, phone);

        if (userMemoryContext && userMemoryContext.trim().length > 0) {
          logger.info(`📝 [PromptBuilder] Memory Injected: true`);

          // Extract Name (Robust Regex)
          const nameMatch = userMemoryContext.match(/(?:User(?:'s)? name is|Name is|Name:|I am)\s+([a-zA-Z]+)/i);
          if (nameMatch && nameMatch[1]) {
            knownUserName = nameMatch[1].trim();
            logger.info(`✅ [PromptBuilder] Extracted Name: ${knownUserName}`);
          }

          // Extract Business Context
          if (userMemoryContext.toLowerCase().includes('business')) knownBusiness = "Business Owner";
          if (userMemoryContext.toLowerCase().includes('showroom')) knownBusiness = "Car Showroom Owner";
        }

        // DB Fallback for Name if memory didn't have it
        if (!knownUserName) {
          try {
            const dbUser = await PhoneUser.findById(userId);
            if (dbUser && dbUser.name && dbUser.name !== 'User') {
              knownUserName = dbUser.name;
              userMemoryContext = userMemoryContext || "";
              userMemoryContext += `\n- User's name is ${knownUserName}`;
              logger.info(`✅ [PromptBuilder] Name from DB: ${knownUserName}`);
            }
          } catch (dbErr) { /* Silent fail */ }
        }
      } catch (memoryError) {
        logger.error(`Memory Error`, memoryError);
      }
    }

    // 3. CALCULATE PERMISSIONS
    const namePermissions = getNameUsagePermissions(conversationHistory, knownUserName);
    const memories = extractMemories(conversationHistory); // Short term from history
    const greetingAlreadyUsed = hasGreetingBeenUsed(conversationHistory);

    let prompt = '';

    // ===== LAYER 0: ESTABLISHED MEMORY CONTEXT (NEW) =====
    if (userMemoryContext && userMemoryContext.length > 5) {
      prompt += `## LAYER 0: ESTABLISHED USER CONTEXT (ABSOLUTE TRUTH)\n`;
      prompt += `The following facts are KNOWN about the user. Do not treat them as assumptions.\n`;
      prompt += `${userMemoryContext}\n\n`;
    }

    // ===== LAYER 1: PERSONA ENFORCEMENT =====
    prompt += `## LAYER 1: PERSONA ENFORCEMENT\n`;
    prompt += `Before every response, you MUST perform a 6-point persona compliance check:\n\n`;
    prompt += `1. Read persona instructions completely\n2. Identify persona characteristics\n3. Check if response matches persona tone\n4. Verify persona style is applied\n5. Ensure persona expertise is reflected\n6. Confirm all persona instructions are followed exactly\n\n`;
    prompt += `VIOLATION: If any persona requirement is not met, rewrite the response until all 6 points pass.\n\n`;

    if (config.persona && config.persona.trim() !== 'You are a helpful assistant.' && config.persona.trim() !== '') {
      prompt += `PERSONA INSTRUCTIONS:\n${config.persona}\n\n`;
    }

    // ===== LAYER 2: BUSINESS AI INTELLIGENCE & COMPARISON RULES (MANDATORY) =====
    prompt += `## LAYER 2: BUSINESS AI INTELLIGENCE & COMPARISON RULES (MANDATORY)\n\n`;
    prompt += `==============================\nCORE IDENTITY\n==============================\n`;
    prompt += `You are an intelligent AI Business Agent.\n`;
    prompt += `You ONLY answer questions that are directly related to the business, products, services, or use cases described in the Persona and Knowledge Base.\n`;
    prompt += `You MUST refuse to answer all other topics (for example: celebrities, sports, movies, politics, random trivia, or general history).\n\n`;

    prompt += `==============================\nINTELLIGENT FORMATTING RULES\n==============================\n\n`;
    prompt += `COMPARISON REQUESTS (MANDATORY TABLES):\n`;
    prompt += `If the user asks for a comparison between two or more items (products, services, agents, plans, tools, features):\n`;
    prompt += `  → You MUST respond ONLY in a MARKDOWN TABLE.\n`;
    prompt += `  → Do NOT write paragraphs, explanations, bullet points, or long text.\n`;
    prompt += `  → If a table is not used, the response is considered INCORRECT.\n\n`;

    prompt += `TABLE DESIGN INTELLIGENCE:\n`;
    prompt += `- First column MUST be the comparison parameter (Feature / Aspect / Criteria)\n`;
    prompt += `- Each compared item MUST have its own column\n`;
    prompt += `- Keep wording short, clear, and business-focused\n`;
    prompt += `- Use professional labels (e.g., Purpose, Use Case, Availability, Benefits)\n`;
    prompt += `- Never mix tables with paragraphs for comparisons\n`;
    prompt += `- No intro text like "Here is the comparison" - directly start with the table\n\n`;

    prompt += `STRICT FORMATTING RULES (MANDATORY FOR ALL RESPONSES):\n`;
    prompt += `Every response MUST be visually structured and easy to scan.\n\n`;
    prompt += `PRINCIPLES:\n`;
    prompt += `→ Use **bold** to highlight key information the reader should notice first\n`;
    prompt += `→ When listing 3 or more items, ALWAYS use bullet points or numbered lists\n`;
    prompt += `→ Keep paragraphs short (2-3 sentences max) for better readability\n`;
    prompt += `→ Add line breaks between different topics or sections\n`;
    prompt += `→ Structure your response so users can quickly find what they need\n\n`;
    prompt += `Think like a UX designer - make every response scannable, not a wall of text.\n\n`;

    prompt += `OTHER RESPONSES (FLEXIBLE FORMATTING):\n`;
    prompt += `For all other types of queries (not comparisons):\n`;
    prompt += `  → Paragraphs for explanations and narratives\n`;
    prompt += `  → Bullet points (- item) for lists and features\n`;
    prompt += `  → Numbered lists (1. item) for steps or ordered information\n`;
    prompt += `  → Use **bold** for emphasis and headings\n`;
    prompt += `  → Tables only when comparing items\n`;
    prompt += `  → Code blocks for technical content\n\n`;

    prompt += `FAIL-SAFE RULE:\n`;
    prompt += `If you accidentally generate a comparison in text form, you MUST immediately rewrite it into a markdown table.\n\n`;

    // ===== LAYER 3: INSTRUCTION FOLLOWING FRAMEWORK =====
    prompt += `## LAYER 3: INSTRUCTION FOLLOWING FRAMEWORK\n`;
    prompt += `Follow these 7 steps in order:\n`;
    prompt += `1. Read persona instructions\n2. Identify user intent (${intent})\n3. Check knowledge base FIRST\n4. Check persona instructions\n5. Follow persona patterns\n6. Apply tone and style\n7. Provide response\n\n`;

    // ===== LAYER 4: SALES GOALS =====
    if (config.salesGoal) {
      prompt += `## LAYER 4: SALES GOALS\n${config.salesGoal}\n\n`;
    } else {
      prompt += `## LAYER 4: SALES GOALS\n- Understand customer needs\n- Demonstrate value\n- Guide conversation towards solutions\n\n`;
    }

    // ===== LAYER 5: KNOWLEDGE BASE =====
    if (knowledgeFiles.length > 0) {
      prompt += `## LAYER 5: KNOWLEDGE BASE (CRITICAL - READ THIS FIRST)\n`;
      prompt += `✅ KNOWLEDGE BASE IS AVAILABLE - YOU MUST USE IT TO ANSWER QUESTIONS\n\n`;
      prompt += `--- KNOWLEDGE BASE CONTENT ---\n`;
      knowledgeFiles.forEach((file, index) => {
        if (file.content) prompt += `\n[Knowledge Base Chunk ${index + 1}: ${file.name}]\n${file.content}\n`;
      });
      prompt += `\n--- END KNOWLEDGE BASE ---\n\n`;
    } else {
      prompt += `## LAYER 5: KNOWLEDGE BASE STATUS\n⚠️ NO KNOWLEDGE BASE PROVIDED\n\n`;
    }

    // ===== LAYER 6: PERSONA INSTRUCTIONS =====
    prompt += `## LAYER 6: PERSONA INSTRUCTIONS\n`;
    if (config.persona && config.persona.trim() !== 'You are a helpful assistant.' && config.persona.trim() !== '') {
      prompt += `${config.persona}\n\n`;
    }

    // Short-term memories from current session
    if (memories.length > 0) {
      prompt += `CONVERSATION MEMORIES (Last 20 important facts from current session):\n`;
      memories.forEach((memory) => prompt += `- ${memory}\n`);
      prompt += `\nUse these memories to provide context-aware responses.\n\n`;
    }

    // ===== LAYER 7: RESPONSE QUALITY REQUIREMENTS =====
    prompt += `## LAYER 7: RESPONSE QUALITY REQUIREMENTS\n`;
    prompt += `Verify 6 checkpoints: Persona instructions, Language compliance, Expertise area, Natural language, Context building, Persona patterns.\n\n`;

    // ===== LAYER 7.5: BUSINESS CONTEXTUALIZATION (NEW) =====
    prompt += `## LAYER 7.5: BUSINESS CONTEXTUALIZATION\n`;
    if (knownBusiness || (userMemoryContext && userMemoryContext.includes('Showroom'))) {
      prompt += `1. **CONTEXT LOCK:** You know the user runs a **Car Showroom**. DO NOT speak generically.\n`;
      prompt += `2. **APPLICATION:** When explaining features (like 24/7 support), explain EXACTLY how it helps a Car Showroom.\n`;
      prompt += `3. **Example:** Instead of "It generates leads", say "It captures potential car buyers instantly."\n\n`;
    } else {
      prompt += `If Layer 0 contains business details, customize your answer to that specific industry.\n\n`;
    }

    // ===== LAYER 8: TIME-BASED GREETINGS & NAME PROTOCOL (MERGED) =====
    if (timeString) {
      prompt += `## LAYER 8: TIME-BASED GREETINGS & CONTEXT AWARENESS (MANDATORY)\n`;
      prompt += `Current time information: ${timeString}\n\n`;

      prompt += `### GREETING & NAME RULES:\n`;

      // 1. START OF CONVERSATION
      prompt += `1. **START OF CONVERSATION:**\n`;
      if (knownUserName) {
        prompt += `   - **MANDATORY:** Start with "${greetingPhrase} ${knownUserName}!" if this is the first message.\n`;
      } else {
        prompt += `   - Start with "${greetingPhrase}!"\n`;
      }

      // 2. MID-CHAT RULES
      prompt += `2. **MID-CHAT NAME USAGE:**\n`;
      if (knownUserName && namePermissions.allowed) {
        prompt += `   - ✅ **PERMISSION GRANTED:** You MAY use the name "**${knownUserName}**" naturally in this response.\n`;
        prompt += `   - **STRATEGY:** Use it to build trust or transition topics.\n`;
      } else if (knownUserName) {
        prompt += `   - 🛑 **PERMISSION DENIED:** Do NOT use the name "**${knownUserName}**" here to prevent repetition.\n`;
      }

      // 3. HISTORY CHECK
      if (greetingAlreadyUsed) {
        prompt += `3. **HISTORY CHECK:** Greetings have ALREADY been used. DO NOT greet again. Start directly with the answer.\n\n`;
      } else {
        prompt += `3. **HISTORY CHECK:** If no previous greetings exist, use the greeting rule above.\n\n`;
      }
    }

    // ===== LAYER 9: STRICT BEHAVIORAL RULES =====
    prompt += `## LAYER 9: STRICT BEHAVIORAL RULES (MANDATORY)\n\n`;
    prompt += `### 1. KNOWLEDGE BASE PRIORITY: Always use the Knowledge Base when available.\n`;
    prompt += `### 2. PERSONA SCOPE ENFORCEMENT: Stay strictly within the business domain described in the Persona and Knowledge Base.\n`;
    prompt += `### 3. NO OUT-OF-SCOPE CONTENT: Do NOT answer questions about unrelated topics such as celebrities, sports, movies, politics, random trivia, or general history.\n`;
    prompt += `### 4. OFF-TOPIC REDIRECTION: If the user asks an out-of-scope question, politely refuse and redirect back to the business domain.\n`;
    prompt += `### 5. FOLLOW-UP SHORT ANSWERS: If the user replies with short confirmations (e.g., "yes", "no", "ok", "sure", "go ahead") that clearly refer to your previous in-scope suggestion or tool action, treat them as follow-up intent, NOT as new out-of-scope questions.\n\n`;

    // ===== LAYER 9.5: VISUAL LEARNING (NEW) =====
    prompt += `## LAYER 9.5: VISUAL LEARNING\n`;
    prompt += `Assess if the users would be able to understand response better with the use of diagrams and trigger them. You can insert a diagram by adding the

[Image of X]
 tag where X is a contextually relevant query. Examples:

[Image of hydrogen fuel cell]
. Avoid triggering images just for visual appeal. Be economical but strategic. Place the image tag immediately before or after the relevant text.\n\n`;

    // ===== LAYER 9.6: TOOL USAGE INTELLIGENCE =====
    prompt += `## LAYER 9.6: TOOL USAGE INTELLIGENCE\n`;
    prompt += `Use judgment to call tools when user expresses interest in proposals, emails, or calls.\n\n`;

    // ===== LAYER 10: TOOL CALLING INSTRUCTIONS =====
    prompt += `## LAYER 10: TOOL CALLING INSTRUCTIONS (CRITICAL)\n`;
    prompt += `1. **IF USER ASKS AN IN-SCOPE QUESTION** (within the business domain) -> Answer first, then call tool if helpful.\n`;
    prompt += `2. **IF USER ASKS AN OUT-OF-SCOPE QUESTION** (celebrities, sports, trivia, etc.) -> Do NOT answer. Politely refuse and redirect back to the business domain.\n`;
    prompt += `3. **IF USER GIVES A COMMAND OR CONFIRMATION** related to your previous in-scope suggestion or tool usage (e.g., "yes", "no", "send it", "schedule it") -> Treat it as follow-up intent and call tools accordingly.\n\n`;
    if (toolInstructions) prompt += `${toolInstructions}\n\n`;

    // ===== LAYER 11: LANGUAGE OVERRIDE =====
    prompt += `==================================================\n`;
    if (detectedLanguageObj) {
      prompt += `🛑 MANDATORY: Write response ONLY in **${detectedLanguageObj.language}** using **${detectedLanguageObj.script} script**.\n`;
    } else {
      prompt += `🛑 MANDATORY: Detect language from latest user message and reply in that exact language.\n`;
    }
    prompt += `==================================================\n\n`;

    return prompt;
  } catch (error) {
    logger.error('Prompt building error:', error);
    return persona || 'You are a helpful assistant.';
  }
}

function getTimeContextForLLM() {
  const now = new Date();
  const istTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const hour = istTime.getHours();
  let timeOfDay = 'morning';
  let greeting = 'Good Morning';

  if (hour >= 12 && hour < 17) { timeOfDay = 'afternoon'; greeting = 'Good Afternoon'; }
  else if (hour >= 17 && hour < 21) { timeOfDay = 'evening'; greeting = 'Good Evening'; }
  else if (hour >= 21 || hour < 5) { timeOfDay = 'late night'; greeting = 'Hi'; }

  return {
    text: `Current IST time: ${istTime.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      dateStyle: 'full',
      timeStyle: 'long',
    })} (Hour: ${hour}, Use greeting: ${greeting})`,
    greeting: greeting
  };
}

module.exports = {
  buildPrompt,
  getTimeContextForLLM,
};

