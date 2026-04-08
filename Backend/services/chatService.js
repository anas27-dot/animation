const languageService = require('./languageService');
const queryRewriteService = require('./queryRewriteService');
const intentDetectionService = require('./intentDetectionService');
const vectorSearchService = require('./vectorSearchService');
const contextAwarePromptService = require('./contextAwarePromptService');
const { getLLMAdapter } = require('./llmAdapter');
const { retrieveUserContext } = require('./memoryService');
const Chatbot = require('../models/Chatbot');
const logger = require('../config/logging');
const { recordMetric, withLatency } = require('../utils/cloudwatch');
const { resolvePublicAssetUrl } = require('../utils/publicUrl');

const MAX_RESPONSE_LENGTH = 2000;

// 🚀 UPDATED SIGNATURE
async function* generateStreamingAnswer(query, chatbotId, userId = null, history = [], options = {}) {
  logger.info('🚀 [ChatService] generateStreamingAnswer started');
  // Record that a new stream has started
  recordMetric('ActiveStreams', 1, 'Count', { ChatbotId: chatbotId });

  try {
    logger.info('🌍 [Language Detection] Delegated to OpenAI');

    const normalizeQuery = (input) => {
      if (typeof input === 'string') {
        return { safeText: input, llmContent: input };
      }
      if (Array.isArray(input)) {
        const textPart = input.find(part => part && part.type === 'text');
        const safeText = typeof textPart?.text === 'string' ? textPart.text : '';
        return { safeText, llmContent: input };
      }
      if (input && typeof input === 'object') {
        const safeText = typeof input.text === 'string'
          ? input.text
          : (typeof input.content === 'string' ? input.content : '');
        return { safeText, llmContent: safeText || JSON.stringify(input) };
      }
      const fallback = String(input ?? '');
      return { safeText: fallback, llmContent: fallback };
    };

    const { safeText, llmContent } = normalizeQuery(query);

    // 1. Query rewriting
    const rewrittenQuery = await queryRewriteService.rewriteQuery(safeText, { history });

    // 2. Language Detection
    let detectedLanguageObj = { language: 'English', script: 'Latin' };
    try {
      detectedLanguageObj = await languageService.detectLanguage(safeText);
    } catch (langError) {
      logger.warn('Failed to detect language explicitly, defaulting to English');
    }

    // 3. Intent & Config
    const intent = await intentDetectionService.detectIntent(safeText);
    const chatbot = await Chatbot.findById(chatbotId);
    if (!chatbot || !chatbot.isActive) throw new Error('Chatbot not found or inactive');

    // 3.5 Product Images Logic
    let productImagesMarkdown = '';
    try {
      const piConfig = chatbot.settings?.product_images;
      if (piConfig && piConfig.enabled && piConfig.images && piConfig.images.length > 0) {
        const lowerQuery = safeText.toLowerCase();
        let selectedImages = [];
        const maxImages = 3;

        // Check Matches
        const mainMatch = piConfig.main_keyword && lowerQuery.includes(piConfig.main_keyword.toLowerCase());

        // 1. Identify which keywords caused a match
        const matchedKeywords = new Set();
        const specificMatches = piConfig.images.filter(img => {
          if (!img.keywords) return false;
          const matchingKeyword = img.keywords.find(k => lowerQuery.includes(k.toLowerCase()));
          if (matchingKeyword) {
            matchedKeywords.add(matchingKeyword.toLowerCase());
            // Store which keyword matched this image for later grouping if needed
            img._matchedKeyword = matchingKeyword.toLowerCase();
            return true;
          }
          return false;
        });

        if (mainMatch && specificMatches.length > 0) {
          // Both match: Priority to specific, fill with others

          // Strategy: Try to pick at least one image for EACH matched keyword to ensure variety
          const distinctImages = [];
          const usedImageIds = new Set();

          // First pass: Pick one image for each distinct matched keyword
          matchedKeywords.forEach(keyword => {
            const candidate = specificMatches.find(img => img._matchedKeyword === keyword && !usedImageIds.has(img.url)); // Use URL or name as ID
            if (candidate) {
              distinctImages.push(candidate);
              usedImageIds.add(candidate.url);
            }
          });

          // Second pass: Fill remaining slots with other specific matches
          const remainingSpecific = specificMatches.filter(img => !usedImageIds.has(img.url));
          // Shuffle remaining to avoid rigid order
          remainingSpecific.sort(() => 0.5 - Math.random());

          let finalSelection = [...distinctImages, ...remainingSpecific];

          // If still under limit and we have main match, can we add random others?
          // The requirements say: if both match, prioritize specific. 
          // Usually we just stick to specific if they exist.

          selectedImages = finalSelection.slice(0, maxImages);

        } else if (specificMatches.length > 0) {
          // Only specific match
          // Same strategy: Ensure variety across matched keywords
          const distinctImages = [];
          const usedImageIds = new Set();

          matchedKeywords.forEach(keyword => {
            const candidate = specificMatches.find(img => img._matchedKeyword === keyword && !usedImageIds.has(img.url));
            if (candidate) {
              distinctImages.push(candidate);
              usedImageIds.add(candidate.url);
            }
          });

          const remainingSpecific = specificMatches.filter(img => !usedImageIds.has(img.url));
          remainingSpecific.sort(() => 0.5 - Math.random()); // Shuffle remaining

          selectedImages = [...distinctImages, ...remainingSpecific].slice(0, maxImages);

        } else if (mainMatch) {
          // Only main match: Random 3
          const shuffled = [...piConfig.images].sort(() => 0.5 - Math.random());
          selectedImages = shuffled.slice(0, maxImages);
        }

        // Generate HTML Gallery for horizontal display and smaller size (3 per line)
        if (selectedImages.length > 0) {
          productImagesMarkdown =
            '<div style="display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 15px; justify-content: flex-start;">' +
            selectedImages.map((img) => {
              const src = resolvePublicAssetUrl(img.url || '').replace(/"/g, '&quot;');
              const alt = String(img.name || 'Product').replace(/"/g, '&quot;');
              return `<img src="${src}" alt="${alt}" style="width: calc(33.33% - 7px); aspect-ratio: 1/1; object-fit: cover; border-radius: 8px; border: 1px solid #eee; display: block;" />`;
            }).join('') +
            '</div>\n\n';
          logger.info(`🖼️ [Product Images] Selected ${selectedImages.length} images for display.`);
        }
      }
    } catch (err) {
      logger.error('Error in Product Images logic:', err);
    }

    // 4. Determine Force Tool Call Strategy (The Router)
    // We check this EARLY to decide if we need to force a tool and inject generic text
    let forceToolStrategy = null; // 'proposal', 'email', 'calling', or null
    let toolChoice = 'auto';      // Default to auto
    let fillerText = null;        // Text to show while tool runs

    // Lightweight channel detector to reduce intent collisions
    const detectChannelFromText = (q) => {
      if (!q || typeof q !== 'string') return null;
      const m = q.toLowerCase();
      if (m.includes('whatsapp') || m.includes("what'sapp") || m.includes('wa ')) return 'whatsapp';
      if (m.includes('email') || m.includes('mail') || m.includes('gmail')) return 'email';
      return null;
    };
    const detectedChannel = detectChannelFromText(safeText);
    const keywords = chatbot.settings?.intentKeywords || [];

    // 5. RAG retrieval
    let knowledgeChunks = [];
    const internalKBCount = chatbot.knowledgeBase?.length || 0;

    knowledgeChunks = await withLatency('RAGLatency', () =>
      vectorSearchService.search(rewrittenQuery, chatbotId, {
        limit: 5,
        minScore: 0.2,
      }),
      { ChatbotId: chatbotId }
    );

    if (knowledgeChunks.length === 0 && internalKBCount > 0) {
      knowledgeChunks = chatbot.knowledgeBase.map(item => ({
        content: item.content,
        metadata: item.metadata || { source: item.title }
      }));
    }

    // 6. Build Messages
    const timeContext = contextAwarePromptService.getTimeContextForLLM();
    const messages = history
      .filter((msg) => msg.role === 'user' || msg.role === 'assistant')
      .slice(-10)
      .map((msg) => {
        let content = msg.content;
        if (typeof msg.content === 'string' && msg.content.trim().startsWith('[')) {
          try { content = JSON.parse(msg.content); } catch (e) { content = msg.content; }
        }
        return { role: msg.role, content: content };
      });

    logger.info('🤖 [LLM Context] Messages sent to LLM:', {
      historyCount: history.length,
      filteredCount: messages.length,
      currentQuery: safeText.substring(0, 100),
      messages: messages.map(m => ({
        role: m.role,
        contentPreview: typeof m.content === 'string' ? m.content.substring(0, 50) : '[object]'
      }))
    });

    // Formatting rules are now handled by system prompt - no need to append to user messages
    let finalUserMessage = llmContent;

    messages.push({ role: 'user', content: finalUserMessage });

    logger.info('📝 [Final Message] User message added to LLM context:', {
      originalQuery: safeText,
      finalUserMessage: safeText.substring(0, 200),
      totalMessages: messages.length
    });

    // 7. Get Adapter
    const llmProvider = chatbot.settings?.llmProvider || 'openai';
    const llmAdapter = getLLMAdapter(llmProvider);

    // 8. Build Tools
    const tools = [];
    let toolInstructions = null;

    if (chatbot.settings?.intentEnabled) {
      tools.push({
        type: 'function',
        function: {
          name: 'check_proposal_intent',
          description: chatbot.settings?.proposal_condition || `Call this if user wants a proposal. CRITICAL: You MUST look at the 'conversation history' to find the specific product name (e.g. 'Swara', 'OmniAgent', 'Calling Agent') the user was discussing. You MUST include this name in the 'requested_template_keyword' parameter. Do NOT leave it empty if the user mentioned a product previously.`,
          parameters: {
            type: 'object',
            properties: {
              user_message: { type: 'string' },
              requested_template_keyword: {
                type: 'string',
                description: `The specific product name found in the chat history (e.g. 'Swara', 'OmniAgent'). If the user said 'I want to buy Swara' earlier, put 'Swara' here.`,
              },
              email: { type: 'string' },
            },
            required: ['user_message'],
          },
        },
      });
    }
    if (chatbot.settings?.email_intent?.enabled) {
      tools.push({
        type: 'function',
        function: {
          name: 'check_email_intent',
          description: chatbot.settings?.email_intent?.condition || `Call this if user wants an email. CRITICAL: You MUST look at the 'conversation history' to find the specific product name (e.g. 'Swara', 'OmniAgent') the user was discussing. You MUST include this name in the 'requested_template_keyword' parameter. Do NOT leave it empty if the user mentioned a product previously.`,
          parameters: {
            type: 'object',
            properties: {
              user_message: { type: 'string' },
              requested_template_keyword: {
                type: 'string',
                description: `The specific product name found in the chat history (e.g. 'Swara', 'OmniAgent'). If the user said 'I want to buy Swara' earlier, put 'Swara' here.`,
              },
              email: { type: 'string' },
            },
            required: ['user_message'],
          },
        },
      });
    }
    if (chatbot.settings?.calling_tool?.enabled) {
      tools.push({
        type: 'function',
        function: {
          name: 'check_calling_intent',
          description: chatbot.settings?.calling_tool?.condition || `Call this to initiate the calling flow.`,
          parameters: { type: 'object', properties: { user_message: { type: 'string' } }, required: ['user_message'] },
        },
      });
    }

    // 9. Memory Retrieval (phone = identity anchor for device-agnostic memory)
    let userContext = '';
    const phone = options?.phone ? String(options.phone).replace(/\D/g, '') : null;
    if (userId && userId !== 'guest') {
      try {
        userContext = await retrieveUserContext(userId, rewrittenQuery, chatbotId, phone);
      } catch (contextError) {
        logger.warn(`⚠️ [Memory] Failed to retrieve context:`, contextError.message);
      }
    }

    // 10. System Prompt (Safe Build)
    let systemPrompt = await contextAwarePromptService.buildPrompt({
      persona: chatbot.persona,
      knowledgeBase: knowledgeChunks,
      conversationHistory: history,
      timeContext,
      query: rewrittenQuery,
      intent,
      toolInstructions: toolInstructions,
      detectedLanguageObj: detectedLanguageObj,
      userId: userId,
      chatbotId: chatbotId,
      phone: phone
    });

    // 🚨 SAFETY FIX: Handle non-string returns to prevent crash
    if (!systemPrompt || typeof systemPrompt !== 'string') {
      logger.warn('⚠️ [ChatService] buildPrompt returned non-string. Using fallback persona.');
      systemPrompt = chatbot.persona || 'You are a helpful assistant.';
    }

    logger.info('📋 [System Prompt Preview]:', systemPrompt.substring(0, 500));

    // 10. GENERATION & YIELDING

    // [CRITICAL FIX] If we are forcing a strategy, yield the filler text IMMEDIATELY
    // This ensures the user sees a response bubble (Step 1 of "The Fix")
    if (forceToolStrategy && fillerText) {
      logger.info(`🚀 [Router] Injecting filler text: "${fillerText}"`);
      yield {
        type: 'text',
        data: fillerText + "\n", // Add newline to separate from RAG or tool content
      };
    }

    // Log the prompt snippet safely
    logger.info('📋 [System Prompt Preview]:', systemPrompt.substring(0, 200));

    // 11. Generation
    let fullResponse = '';
    let eventCount = 0;
    let hasToolCall = false;

    // ===== STREAMING WITH COMPLETE RESPONSE FORMATTING =====
    // Collect all chunks first, then apply formatting once at the end
    // This prevents list items from being broken across chunk boundaries

    let rawChunks = [];

    // Yield Product Images if any (BEFORE text response)
    if (productImagesMarkdown) {
      fullResponse += productImagesMarkdown;
      yield { type: 'text', data: productImagesMarkdown };
    }

    // Stream from LLM
    // Note: If forceToolStrategy is set, toolChoice is specific (e.g. check_proposal_intent)
    // If NOT set, toolChoice is 'auto' (Standard RAG flow)
    for await (const event of llmAdapter.generateStreamingCompletion(
      messages,
      systemPrompt,
      {
        temperature: chatbot.settings?.temperature || 0.7,
        maxTokens: chatbot.settings?.maxTokens || 500,
        tools: tools.length > 0 ? tools : undefined,
        tool_choice: 'auto',
      }
    )) {
      eventCount++;

      if (event.type === 'content') {
        fullResponse += event.content;
        rawChunks.push(event.content);
        // Yield raw chunk immediately for real-time feel
        yield { type: 'text', data: event.content };
      }
      else if (event.type === 'tool_calls') {
        hasToolCall = true;
        for (const toolCall of event.toolCalls) {
          const name = toolCall.function?.name;
          if (name === 'check_proposal_intent') yield { type: 'proposal_intent_detected', data: { toolCall, userMessage: query, detectedLanguage: detectedLanguageObj } };
          else if (name === 'check_email_intent') yield { type: 'email_intent_detected', data: { toolCall, userMessage: query, detectedLanguage: detectedLanguageObj } };
          else if (name === 'check_calling_intent') yield { type: 'calling_intent_detected', data: { toolCall, userMessage: query, detectedLanguage: detectedLanguageObj } };
        }
      }
      else if (event.type === 'error') {
        yield { type: 'error', error: event.error };
      }
      else if (event.type === 'complete') {
        yield {
          type: 'complete',
          tokens: event.tokens,
          fullResponse: fixAllListFormatting(fullResponse)
        };
      }
    }



    // [Full AI Control Fallback]
    // If the user's query clearly indicates a specific intent (based on keywords),
    // but the LLM decided purely to talk and NOT call the tool, we inject the tool call manually.
    // This acts as a safety net for the "Lazy AI" problem.
    // [Full AI Control Fallback]
    // If the user's query clearly indicates a specific intent (based on keywords),
    // but the LLM decided purely to talk and NOT call the tool, we inject the tool call manually.
    // This acts as a safety net for the "Lazy AI" problem.

    if (!hasToolCall) {
      // Check Proposal Keywords for Fallback
      const proposalKickIn = chatbot.settings?.intentEnabled &&
        chatbot.settings?.proposal_condition && query.toLowerCase().includes(chatbot.settings.proposal_condition.toLowerCase());

      if (proposalKickIn) {
        logger.info('🚀 [Fallback] AI talked but missed Proposal Tool. Injecting now.');
        yield {
          type: 'proposal_intent_detected',
          data: {
            toolCall: { id: 'fallback_' + Date.now(), function: { name: 'check_proposal_intent', arguments: JSON.stringify({ user_message: query }) } },
            userMessage: query,
            detectedLanguage: detectedLanguageObj
          }
        };
      }

      // Check Calling Keywords for Fallback
      const callingCondition = chatbot.settings?.calling_tool?.condition;
      const callingKickIn = chatbot.settings?.calling_tool?.enabled &&
        callingCondition && query.toLowerCase().includes(callingCondition.toLowerCase());

      if (callingKickIn) {
        logger.info('🚀 [Fallback] AI talked but missed Calling Tool. Injecting now.');
        yield {
          type: 'calling_intent_detected',
          data: {
            toolCall: { id: 'fallback_call_' + Date.now(), function: { name: 'check_calling_intent', arguments: JSON.stringify({ user_message: query }) } },
            userMessage: query,
            detectedLanguage: detectedLanguageObj
          }
        };
      }

      // Check Email Keywords for Fallback
      const emailCondition = chatbot.settings?.email_intent?.condition;
      const emailKickIn = chatbot.settings?.email_intent?.enabled &&
        emailCondition && query.toLowerCase().includes(emailCondition.toLowerCase());

      if (emailKickIn) {
        logger.info('🚀 [Fallback] AI talked but missed Email Tool. Injecting now.');
        yield {
          type: 'email_intent_detected',
          data: {
            toolCall: { id: 'fallback_email_' + Date.now(), function: { name: 'check_email_intent', arguments: JSON.stringify({ user_message: query }) } },
            userMessage: query,
            detectedLanguage: detectedLanguageObj
          }
        };
      }
    }

    logger.info(`✅ [ChatService] Finished. Events: ${eventCount}`);

  } catch (error) {
    logger.error('Chat service error:', error);
    yield { type: 'error', error: error.message };
  } finally {
    // Record that the stream has ended
    recordMetric('ActiveStreams', -1, 'Count', { ChatbotId: chatbotId });
  }
}

// ... (Keep extractSuggestions, extractMetadata, classifyConfirmation) ...

/**
 * Classifies a user response as POSITIVE, NEGATIVE, or AMBIGUOUS
 * using a lightweight LLM call.
 */
async function classifyConfirmation(userText) {
  const llmAdapter = getLLMAdapter();
  const systemPrompt = `You are a helpful assistant that classifies user responses to confirmation questions.
The user was asked a Yes/No question or a confirmation question.
The user may respond in English or ANY Indian language (Hindi, Marathi, Tamil, Telugu, Kannada, Gujarati, Bengali, etc.) using either native script or Roman script (e.g., Hinglish).

Classify their response into one of three categories:
1. POSITIVE: The user agrees, says yes, or confirms.
   - English: "Yes", "Sure", "Okay", "Go ahead", "Confirm"
   - Hindi/Hinglish: "Haan", "Haanji", "Bilkul", "Sahi hai", "Bhejo", "Ha"
   - Marathi: "Ho", "Hoy", "Barobar", "Pathva"
   - Tamil: "Ama", "Amam", "Seri", "Anuppunga"
   - Telugu: "Avunu", "Sare", "Pampandi"
   - Kannada: "Howdu", "Sari", "Kalsi"
   - Gujarati: "Ha", "Barabar", "Moklo"

2. NEGATIVE: The user disagrees, says no, or cancels.
   - English: "No", "Nope", "Cancel", "Stop", "Don't send", "Wrong"
   - Hindi/Hinglish: "Nahi", "Na", "Mat bhejo", "Rahne do", "Galat hai"
   - Marathi: "Nako", "Naahi", "Chukicha"
   - Tamil: "Venda", "Illai"
   - Telugu: "Vaddu", "Kadu"
   - Kannada: "Beda", "Illa"
   - Gujarati: "Na", "Nahi", "Raho do"

3. AMBIGUOUS: The user asks a question, says something unrelated, or it's unclear.
   - Examples: "What is the price?", "Wait", "Who are you?", "Tell me more", "Price kya hai?", "Kiti rupaye?"

You must respond with ONLY a valid JSON object in this format:
{ "status": "POSITIVE" } or { "status": "NEGATIVE" } or { "status": "AMBIGUOUS" }`;

  const messages = [{ role: 'user', content: userText }];

  try {
    // Use the non-streaming generation
    const response = await llmAdapter.generateCompletion(messages, systemPrompt, {
      temperature: 0,
      maxTokens: 50,
      jsonMode: true // Hint for JSON mode if supported
    });

    let result = { status: 'AMBIGUOUS' };
    try {
      const rawContent = response?.content;
      if (!rawContent || typeof rawContent !== 'string') {
        logger.warn('Classification returned empty or invalid content');
        return result;
      }
      // Clean markdown code blocks if present (just in case)
      const cleanContent = rawContent.replace(/```json/g, '').replace(/```/g, '').trim();

      // Parse JSON
      const parsed = JSON.parse(cleanContent);
      if (parsed.status && ['POSITIVE', 'NEGATIVE', 'AMBIGUOUS'].includes(parsed.status)) {
        result = parsed;
      }
    } catch (e) {
      logger.error('Failed to parse classification JSON:', e);
      // Fallback: simple text matching if JSON fails
      const text = (rawContent || '').toUpperCase();
      if (text.includes('POSITIVE')) result = { status: 'POSITIVE' };
      else if (text.includes('NEGATIVE')) result = { status: 'NEGATIVE' };
    }

    logger.info(`🔍 [Classify] Text: "${userText}" -> Status: ${result.status}`);
    return result;

  } catch (error) {
    logger.error('Classification error:', error);
    return { status: 'AMBIGUOUS' };
  }
}

/**
 * Comprehensive List Formatting Fix
 */
function fixAllListFormatting(text) {
  if (!text || typeof text !== 'string') return text;
  // ... (Keep your existing list formatting logic) ...
  return text; // Placeholder, ensure you keep the full logic
}

module.exports = {
  generateStreamingAnswer,
  MAX_RESPONSE_LENGTH,
  fixAllListFormatting,
  classifyConfirmation,
};

/**
 * Comprehensive List Formatting Fix
 * Handles ALL types of lists - numbered, bullets, letters, roman numerals, checkboxes, arrows
 */
function fixAllListFormatting(text) {
  if (!text || typeof text !== 'string') return text;

  // Split into lines to process each line individually
  const lines = text.split('\n');
  const processedLines = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Check if this line starts a list item
    const isListItem = /^\s*(?:\d+\.|\d+\)|\*|-|•|●|○|◦|▸|▹|‣|⁃|[a-z]\.|[a-z]\)|(?:i{1,3}|iv|vi{0,3}|ix|x{1,3})\.|(?:i{1,3}|iv|vi{0,3}|ix|x{1,3})\)|→|>|<|➤|➜|➡️|▶️|\[[\sxX✓✗]\]|✅|❌|⭐️|📌|🔹|🔸|✨|💡|ℹ️)\s+/.test(line.trim());

    if (isListItem) {
      // This is a list item line - apply formatting within the line only
      // Remove newlines within list item content when followed by **
      line = line
        // ═══════════════════════════════════════════════════════════════
        // NUMBERED LISTS - only remove newlines WITHIN the content
        // ═══════════════════════════════════════════════════════════════
        .replace(/(\d+)\.\s*\n+\s*\*\*/g, '$1. **')      // 1.\n** → 1. **
        .replace(/(\d+)\)\s*\n+\s*\*\*/g, '$1) **')      // 1)\n** → 1) **

        // ═══════════════════════════════════════════════════════════════
        // BULLET POINTS - only remove newlines WITHIN the content
        // ═══════════════════════════════════════════════════════════════
        .replace(/-\s*\n+\s*\*\*/g, '- **')              // -\n** → - **
        .replace(/\*\s+\n+\s*\*\*/g, '* **')             // *\n** → * **
        .replace(/•\s*\n+\s*\*\*/g, '• **')              // •\n** → • **
        .replace(/●\s*\n+\s*\*\*/g, '● **')              // ●\n** → ● **
        .replace(/○\s*\n+\s*\*\*/g, '○ **')              // ○\n** → ○ **
        .replace(/◦\s*\n+\s*\*\*/g, '◦ **')              // ◦\n** → ◦ **
        .replace(/▸\s*\n+\s*\*\*/g, '▸ **')              // ▸\n** → ▸ **
        .replace(/▹\s*\n+\s*\*\*/g, '▹ **')              // ▹\n** → ▹ **
        .replace(/‣\s*\n+\s*\*\*/g, '‣ **')              // ‣\n** → ‣ **
        .replace(/⁃\s*\n+\s*\*\*/g, '⁃ **')              // ⁃\n** → ⁃ **

        // ═══════════════════════════════════════════════════════════════
        // LETTERED LISTS - only remove newlines WITHIN the content
        // ═══════════════════════════════════════════════════════════════
        .replace(/([a-z])\.\s*\n+\s*\*\*/gi, '$1. **')   // a.\n** → a. **
        .replace(/([a-z])\)\s*\n+\s*\*\*/gi, '$1) **')   // a)\n** → a) **

        // ═══════════════════════════════════════════════════════════════
        // ROMAN NUMERALS - only remove newlines WITHIN the content
        // ═══════════════════════════════════════════════════════════════
        .replace(/((?:i{1,3}|iv|vi{0,3}|ix|x{1,3}))\.\s*\n+\s*\*\*/gi, '$1. **')
        .replace(/((?:i{1,3}|iv|vi{0,3}|ix|x{1,3}))\)\s*\n+\s*\*\*/gi, '$1) **')

        // ═══════════════════════════════════════════════════════════════
        // ARROW STYLE - only remove newlines WITHIN the content
        // ═══════════════════════════════════════════════════════════════
        .replace(/→\s*\n+\s*\*\*/g, '→ **')              // →\n** → → **
        .replace(/>\s*\n+\s*\*\*/g, '> **')              // >\n** → > **
        .replace(/>>\s*\n+\s*\*\*/g, '>> **')            // >>\n** → >> **
        .replace(/➤\s*\n+\s*\*\*/g, '➤ **')              // ➤\n** → ➤ **
        .replace(/➜\s*\n+\s*\*\*/g, '➜ **')              // ➜\n** → ➜ **
        .replace(/➡️\s*\n+\s*\*\*/g, '➡️ **')              // ➡️\n** → ➡️ **
        .replace(/▶️\s*\n+\s*\*\*/g, '▶️ **')              // ▶️\n** → ▶️ **

        // ═══════════════════════════════════════════════════════════════
        // CHECKBOX STYLE - only remove newlines WITHIN the content
        // ═══════════════════════════════════════════════════════════════
        .replace(/\[\s*\]\s*\n+\s*\*\*/g, '[ ] **')      // [ ]\n** → [ ] **
        .replace(/\[x\]\s*\n+\s*\*\*/gi, '[x] **')       // [x]\n** → [x] **
        .replace(/\[✓\]\s*\n+\s*\*\*/g, '[✓] **')        // [✓]\n** → [✓] **
        .replace(/\[✗\]\s*\n+\s*\*\*/g, '[✗] **')        // [✗]\n** → [✗] **

        // ═══════════════════════════════════════════════════════════════
        // EMOJI BULLETS - only remove newlines WITHIN the content
        // ═══════════════════════════════════════════════════════════════
        .replace(/✅\s*\n+\s*\*\*/g, '✅ **')
        .replace(/❌\s*\n+\s*\*\*/g, '❌ **')
        .replace(/⭐️\s*\n+\s*\*\*/g, '⭐️ **')
        .replace(/📌\s*\n+\s*\*\*/g, '📌 **')
        .replace(/🔹\s*\n+\s*\*\*/g, '🔹 **')
        .replace(/🔸\s*\n+\s*\*\*/g, '🔸 **')
        .replace(/✨\s*\n+\s*\*\*/g, '✨ **')
        .replace(/💡\s*\n+\s*\*\*/g, '💡 **')
        .replace(/ℹ️\s*\n+\s*\*\*/g, 'ℹ️ **');
    }
    // For non-list lines, just pass through as-is

    processedLines.push(line);
  }

  // Join lines back together and clean up excessive blank lines
  return processedLines.join('\n').replace(/\n{3,}/g, '\n\n');
}

module.exports = {
  generateStreamingAnswer,
  MAX_RESPONSE_LENGTH,
  fixAllListFormatting,
  classifyConfirmation,
};
