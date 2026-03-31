const { qdrant, COLLECTION_NAME } = require('../config/qdrant');
const { v4: uuidv4 } = require('uuid');
const OpenAI = require('openai');
const logger = require('../config/logging');

const getOpenAI = () => new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// 1. Initialize Qdrant
const qdrantClient = qdrant;
const VECTOR_SIZE = 1536;

async function ensureCollection() {
  try {
    const response = await qdrantClient.getCollections();
    const exists = response.collections.some(c => c.name === COLLECTION_NAME);

    if (!exists) {
      console.log(`⚙️ [Qdrant] Creating collection: ${COLLECTION_NAME}...`);
      await qdrantClient.createCollection(COLLECTION_NAME, {
        vectors: { size: VECTOR_SIZE, distance: 'Cosine' }
      });
      await qdrantClient.createPayloadIndex(COLLECTION_NAME, { field_name: "userId", field_schema: "keyword" });
      await qdrantClient.createPayloadIndex(COLLECTION_NAME, { field_name: "chatbotId", field_schema: "keyword" });
      console.log("✅ [Qdrant] Collection & Indexes ready.");
    }
  } catch (err) {
    console.error("❌ [Qdrant] Init Error:", err.message);
  }
}
ensureCollection();

/**
 * Helper to resolve the most permanent identity (Device-Agnostic Memory)
 * If we have a phone, that is the PERMANENT ID across all devices
 */
const getIdentityId = (userId, phone) => {
  if (phone) return String(phone).replace(/\D/g, '');
  return String(userId);
};

/**
 * Helper: Strict Fact Extraction
 */
async function extractFactsFromChat(history) {
  try {
    const openai = getOpenAI();
    const chatText = history.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a Fact Extraction AI. Build a profile of the USER.

          🚨 STRICT RULES FOR EXTRACTION:
          1. **Subject Normalization (CRITICAL):**
             - ALWAYS start facts with "User...".
             - Example: "User runs a coaching business", "User's name is Rahul".
             - NEVER use "I" or the user's actual name as the subject.

          2. **Identity vs. Interest:**
             - "I run a salon" -> EXTRACT: "User's business is a Salon".
             - "I want a salon bot" -> IGNORE (Interest).

          3. **Only Explicit Facts:** Name, Contact, Business Type, Budget, Constraints, Location.

          Output JSON: { "facts": ["User's name is X", "User runs a X business"] }`
        },
        { role: "user", content: `CONVERSATION:\n${chatText}` }
      ],
      temperature: 0,
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(response.choices[0].message.content);
    return result.facts || [];
  } catch (e) {
    logger.error("Fact Extraction Failed", e);
    return [];
  }
}

/**
 * 🧠 2. CONSOLIDATE MEMORY (Save) — Phone-Centric: userId in Qdrant = phone when available (Device-Agnostic)
 */
async function consolidateChatToMemory(userId, chatbotId, sessionId, chatHistory, phone = null) {
  try {
    if (!chatHistory || chatHistory.length === 0) return;
    const facts = await extractFactsFromChat(chatHistory);
    if (!Array.isArray(facts) || facts.length === 0) return;

    const identityId = getIdentityId(userId, phone);

    const openai = getOpenAI();
    const pointsToSave = [];

    for (const fact of facts) {
      if (!fact || fact.trim().length < 5) continue;

      const response = await openai.embeddings.create({ model: "text-embedding-3-small", input: fact.trim() });
      const vector = response.data[0].embedding;

      // 🎯 SEARCH for existing similar facts for THIS user
      const existingFacts = await qdrantClient.search(COLLECTION_NAME, {
        vector: vector,
        limit: 1,
        filter: {
          must: [{ key: "userId", match: { value: identityId } }]
        }
      });

      // 🎯 DEDUPLICATION THRESHOLD: 0.85 — If 85% similar to an old one, don't save it
      if (existingFacts.length > 0 && existingFacts[0].score > 0.85) {
        console.log(`♻️ [Memory] Fact already known: "${fact}" (Score: ${existingFacts[0].score})`);
        continue;
      }

      pointsToSave.push({
        id: uuidv4(),
        vector: vector,
        payload: {
          userId: identityId,
          chatbotId: chatbotId.toString(),
          content: fact.trim(),
          sourceSessionId: sessionId,
          phone: phone ? identityId : null,
          is_authenticated: !!phone,
          createdAt: new Date().toISOString()
        }
      });
    }

    if (pointsToSave.length > 0) {
      await qdrantClient.upsert(COLLECTION_NAME, { wait: true, points: pointsToSave });
      logger.info(`✅ [Qdrant] Saved ${pointsToSave.length} new facts.`);
    }
  } catch (error) {
    logger.error(`❌ [Memory] Save Error: ${error.message}`);
  }
}

/**
 * 🧠 3. RETRIEVE MEMORY (Always On) — Phone-Centric: search by identityId (phone when authenticated)
 */
async function retrieveUserContext(userId, userQuery, chatbotId, phone = null) {
  try {
    const identityId = getIdentityId(userId, phone);

    const openai = getOpenAI();
    let searchInput = userQuery;

    // Greeting Override
    const isGreeting = /^(hello|hi|hey|good\s*(morning|afternoon|evening)|greetings|start|yo|ola)/i.test(userQuery.trim());

    if (isGreeting || userQuery.trim().length < 5) {
      logger.info("🔍 [Memory] Greeting Detected - Fetching Full Profile...");
      searchInput = "User's name, business type, industry, location, budget, contact info";
    } else {
      // 🚀 ALWAYS BOOST CONTEXT
      // Even for "tell me about services", we check if we know the user's business type
      searchInput = `User context for: "${userQuery}". User's name, business, location.`;
    }

    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: searchInput
    });

    const searchResult = await qdrantClient.search(COLLECTION_NAME, {
      vector: response.data[0].embedding,
      limit: 5,
      filter: {
        must: [
          { key: "userId", match: { value: identityId } },
          { key: "chatbotId", match: { value: chatbotId.toString() } }
        ]
      }
    });

    // 🚀 UNIFIED THRESHOLD: 0.22
    // This is low enough to catch "Tell me about services" -> "User runs a coaching business" (similarity ~0.25)
    // But high enough to filter total nonsense.
    const threshold = 0.22;
    const validMatches = searchResult.filter(m => m.score > threshold);

    if (validMatches.length === 0) return "";

    logger.info(`✅ [Memory] Retrieved ${validMatches.length} facts.`);

    return `USER LONG-TERM CONTEXT:\n${validMatches
      .map(m => `- ${m.payload.content}`)
      .join("\n")}`;

  } catch (err) {
    logger.error(`❌ [Qdrant] Retrieve Error: ${err.message}`);
    return "";
  }
}

/**
 * 🚀 4. SAVE EXPLICIT MEMORY (Auth) — Phone-Centric: use identityId for consistency
 */
async function saveExplicitMemory(userId, chatbotId, fact, phone = null) {
  try {
    const identityId = getIdentityId(userId, phone);

    const openai = getOpenAI();
    const cleanFact = fact.trim();
    if (!cleanFact) return;

    const response = await openai.embeddings.create({ model: "text-embedding-3-small", input: cleanFact });
    const vector = response.data[0].embedding;

    // Deduplicate
    const duplicates = await qdrantClient.search(COLLECTION_NAME, {
      vector: vector,
      limit: 1,
      filter: {
        must: [
          { key: "userId", match: { value: identityId } },
          { key: "chatbotId", match: { value: chatbotId.toString() } }
        ]
      }
    });

    if (duplicates.length > 0 && duplicates[0].score > 0.90) {
      logger.info(`♻️ [Memory] Explicit fact exists: "${cleanFact}" (Skipping)`);
      return;
    }

    const payload = {
        userId: identityId,
        chatbotId: chatbotId.toString(),
        content: cleanFact,
        sourceSessionId: "system_auth_event",
        phone: phone ? String(phone).replace(/\D/g, '') : null,
        is_authenticated: !!phone,
        createdAt: new Date().toISOString()
    };

    await qdrantClient.upsert(COLLECTION_NAME, {
      wait: true,
      points: [{ id: uuidv4(), vector: vector, payload: payload }]
    });
    logger.info(`✅ [Memory] Explicit fact saved: "${cleanFact}"`);

  } catch (error) {
    logger.error(`❌ [Memory] Explicit Save Error: ${error.message}`);
  }
}

module.exports = {
  consolidateChatToMemory,
  retrieveUserContext,
  saveExplicitMemory,
  getUserMemoryStats: async () => ({}),
  cleanupOldMemories: async () => ({})
};