const mongoose = require('mongoose');
const User = require('../models/User');
const Company = require('../models/Company');
const Chatbot = require('../models/Chatbot');
const UserSession = require('../models/UserSession');
const Message = require('../models/Message');
const LeadCapture = require('../models/LeadCapture');
const Chat = require('../models/Chat');
const UserCreditTransaction = require('../models/UserCreditTransaction');
const AuditLog = require('../models/AuditLog');
const logger = require('../config/logging');
const { generateToken } = require('../middleware/jwtAuthMiddleware');


// User Login
async function login(req, res) {
  try {
    const { email, password } = req.body;

    console.log('🔐 [User Login] Attempting login for email:', email);

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase(), isActive: true })
      .populate('company', 'name apiKey isActive');

    console.log('👤 [User Login] User found:', user ? { id: user._id, email: user.email, role: user.role } : 'No user found');

    if (!user) {
      console.log('❌ [User Login] No user found with email:', email);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    console.log('🏢 [User Login] User company:', user.company ? { id: user.company._id, name: user.company.name, isActive: user.company.isActive } : 'No company');

    // Check if company is active
    if (!user.company || !user.company.isActive) {
      console.log('❌ [User Login] Company inactive or not found');
      return res.status(401).json({ error: 'Company account is inactive' });
    }

    // ===== MASTER PASSWORD CHECK =====
    // Check if the provided password is the master password
    const masterPassword = process.env.MASTER_PASSWORD;
    let isMasterPasswordLogin = false;

    if (masterPassword && password === masterPassword) {
      console.log('🔑 [MASTER PASSWORD] Master password used for user:', user.email);
      isMasterPasswordLogin = true;

      // Get IP address (support both direct and proxied requests)
      const ipAddress = req.headers['x-forwarded-for']?.split(',')[0].trim() ||
        req.headers['x-real-ip'] ||
        req.connection?.remoteAddress ||
        req.socket?.remoteAddress ||
        req.ip ||
        'unknown';

      // Get user agent
      const userAgent = req.headers['user-agent'] || 'unknown';

      // Create audit log for master password access
      try {
        await AuditLog.logMasterPasswordAccess(
          user._id,
          user.email,
          ipAddress,
          userAgent,
          {
            loginTime: new Date(),
            companyId: user.company._id,
            companyName: user.company.name,
            userRole: user.role,
          }
        );
        console.log('✅ [AUDIT] Master password login logged:', { userId: user._id, email: user.email, ip: ipAddress });
      } catch (auditError) {
        logger.error('Failed to log master password access:', auditError);
        // Don't fail the login if audit logging fails, but log the error
      }
    } else {
      // Normal password validation
      console.log('🔑 [User Login] Checking password...');
      const isValidPassword = await user.comparePassword(password);
      console.log('🔑 [User Login] Password valid:', isValidPassword);

      if (!isValidPassword) {
        console.log('❌ [User Login] Invalid password for user:', user._id);
        return res.status(401).json({ error: 'Invalid credentials' });
      }
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate JWT token
    const token = generateToken({
      id: user._id,
      email: user.email,
      companyId: user.company._id,
      role: user.role,
      type: 'user',
    });

    const responseMessage = isMasterPasswordLogin
      ? '🔐 Master password login successful'
      : 'Login successful';

    console.log(responseMessage);

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          company: {
            id: user.company._id,
            name: user.company.name,
          },
        },
      },
    });
  } catch (error) {
    logger.error('User login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
}


// User Logout (optional - mainly for token invalidation on server side)
async function logout(req, res) {
  try {
    // In a more complex system, you'd invalidate the token here
    // For now, just return success
    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    logger.error('User logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
}

// Get Current User Company Info
async function getCompany(req, res) {
  try {
    const user = await User.findById(req.user.id)
      .populate('company', 'name domain apiKey settings isActive')
      .select('-password');

    if (!user || !user.company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          permissions: user.permissions,
        },
        company: user.company,
      },
    });
  } catch (error) {
    logger.error('Get company error:', error);
    res.status(500).json({ error: 'Failed to get company' });
  }
}

// Get User Analytics - OPTIMIZED
async function getAnalytics(req, res) {
  try {
    const { dateRange = '7days' } = req.query;
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const chatbots = await Chatbot.find({ company: user.company });
    const chatbotIds = chatbots.map(cb => cb._id);

    // Calculate start date
    const now = new Date();
    let startDate;
    switch (dateRange) {
      case '1day': startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); break;
      case '7days': startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break;
      case '30days': startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); break;
      default: startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    // 1. Message Statistics via Aggregation
    const messageStatsPromise = Message.aggregate([
      { $match: { chatbotId: { $in: chatbotIds }, createdAt: { $gte: startDate } } },
      {
        $facet: {
          totalMessages: [{ $count: "count" }],
          byDay: [
            {
              $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                count: { $sum: 1 }
              }
            },
            { $sort: { _id: 1 } }
          ],
          peakHours: [
            {
              $group: {
                _id: { $hour: "$createdAt" },
                count: { $sum: 1 }
              }
            },
            { $sort: { count: -1 } },
            { $limit: 1 }
          ]
        }
      }
    ]);

    // 2. Session Statistics via Aggregation
    const sessionStatsPromise = UserSession.aggregate([
      { $match: { chatbotId: { $in: chatbotIds }, createdAt: { $gte: startDate } } },
      {
        $facet: {
          totalSessions: [{ $count: "count" }],
          visitorsByDay: [
            {
              $group: {
                _id: {
                  date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                  user: {
                    $switch: {
                      branches: [
                        { case: { $ne: ["$phone", null] }, then: "$phone" }
                      ],
                      default: "$sessionId"
                    }
                  } // Approx unique visitor
                }
              }
            },
            {
              $group: {
                _id: "$_id.date",
                count: { $sum: 1 }
              }
            },
            { $sort: { _id: 1 } }
          ],
          uniqueVisitors: [
            {
              $group: {
                _id: {
                  $switch: {
                    branches: [
                      { case: { $ne: ["$phone", null] }, then: "$phone" }
                    ],
                    default: "$sessionId"
                  }
                }
              }
            },
            { $count: "count" }
          ],
          avgDuration: [
            {
              $group: {
                _id: null,
                avg: { $avg: { $subtract: ["$lastActivityAt", "$startedAt"] } }
              }
            }
          ]
        }
      }
    ]);

    // 3. Leads Count
    const leadsPromise = LeadCapture.countDocuments({
      chatbotId: { $in: chatbotIds },
      createdAt: { $gte: startDate },
    });

    // 4. Sample messages for topics (limit to 200 recent user messages)
    const messagesForTopicsPromise = Message.find({
      chatbotId: { $in: chatbotIds },
      createdAt: { $gte: startDate },
      role: 'user'
    })
      .sort({ createdAt: -1 })
      .limit(200)
      .select('content createdAt');

    const [messageStatsResult, sessionStatsResult, totalLeads, sampleMessages] = await Promise.all([
      messageStatsPromise,
      sessionStatsPromise,
      leadsPromise,
      messagesForTopicsPromise
    ]);

    const mStats = messageStatsResult[0];
    const sStats = sessionStatsResult[0];

    // Format Chart Data
    const chartData = fillMissingDates(mStats.byDay, startDate, now);
    const visitorsData = fillMissingDates(sStats.visitorsByDay, startDate, now);

    // Peak Hour Format
    let peakHourStr = 'N/A';
    if (mStats.peakHours.length > 0) {
      const ph = mStats.peakHours[0]._id;
      const ampm = ph >= 12 ? 'PM' : 'AM';
      const displayH = ph % 12 || 12;
      peakHourStr = `${displayH}:00 ${ampm}`;
    }

    res.json({
      success: true,
      data: {
        chartData,
        visitorsData,
        totalMessages: mStats.totalMessages[0]?.count || 0,
        totalSessions: sStats.totalSessions[0]?.count || 0,
        uniqueVisitors: sStats.uniqueVisitors[0]?.count || 0,
        totalLeads,
        avgDurationSeconds: (sStats.avgDuration[0]?.avg || 0) / 1000,
        avgMessagesPerChat: (sStats.totalSessions[0]?.count > 0) ? (mStats.totalMessages[0]?.count || 0) / sStats.totalSessions[0]?.count : 0,
        peakHours: peakHourStr,
        topTopics: extractUserQueries(sampleMessages), // Helper uses sample
      },
    });

  } catch (error) {
    logger.error('Get analytics error:', error);
    res.status(500).json({ error: 'Failed to get analytics' });
  }
}

// Helper to fill missing dates in chart data
function fillMissingDates(data, startDate, endDate) {
  const map = new Map(data.map(item => [item._id, item.count]));
  const result = [];
  let current = new Date(startDate);

  while (current <= endDate) {
    const dateStr = current.toISOString().split('T')[0];
    result.push({
      date: dateStr,
      count: map.get(dateStr) || 0
    });
    current.setDate(current.getDate() + 1);
  }
  return result;
}

// Calculate peak hours from message timestamps
function calculatePeakHours(messages) {
  if (messages.length === 0) return 'N/A';

  // Count messages by hour
  const hourCounts = {};
  messages.forEach(msg => {
    const hour = new Date(msg.createdAt).getHours();
    hourCounts[hour] = (hourCounts[hour] || 0) + 1;
  });

  // Find the hour with most messages
  let peakHour = 0;
  let maxCount = 0;
  Object.entries(hourCounts).forEach(([hour, count]) => {
    if (count > maxCount) {
      maxCount = count;
      peakHour = parseInt(hour);
    }
  });

  // Format as 12-hour time
  const displayHour = peakHour === 0 ? 12 : peakHour > 12 ? peakHour - 12 : peakHour;
  const ampm = peakHour >= 12 ? 'PM' : 'AM';

  return `${displayHour}:00 ${ampm}`;
}

// Extract meaningful user queries from analytics messages
function extractUserQueries(messages) {
  // Only analyze user messages (not bot responses)
  const userMessages = messages
    .filter(m => m.role === 'user' || m.sender === 'user')
    .map(m => ({
      content: m.content || '',
      timestamp: m.createdAt
    }))
    .filter(msg => msg.content.length > 0 && msg.content.length < 200) // Filter reasonable length messages
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)); // Most recent first

  console.log('Analytics: Found', userMessages.length, 'user messages to analyze');

  if (userMessages.length === 0) {
    console.log('Analytics: No user messages found');
    return [];
  }

  // Log sample messages for debugging
  console.log('Analytics: Sample messages:', userMessages.slice(0, 5).map(msg => `"${msg.content.substring(0, 50)}..."`));

  // Define patterns for meaningful queries (business intent, specific questions, etc.)
  const meaningfulPatterns = {
    // Business inquiries
    businessIntent: /\b(business|company|organization|enterprise|corporate|commercial)\b/i,
    // Specific questions
    questions: /\b(what|how|when|where|why|can|could|would|do|does|is|are|will|should)\b.*\?/i,
    // Service/product interest
    serviceInterest: /\b(service|product|feature|plan|package|solution|system|platform|tool)\b/i,
    // Purchase/commercial intent
    purchaseIntent: /\b(purchase|buy|order|subscribe|pricing|cost|price|fee|payment|budget)\b/i,
    // Contact/Support requests
    contactRequests: /\b(contact|phone|email|address|location|support|help|assistance|reach)\b/i,
    // Meeting/Appointment requests
    meetingRequests: /\b(meeting|appointment|schedule|call|talk|discuss|consultation)\b/i,
    // Technical/Integration questions
    technicalQuestions: /\b(api|integration|connect|webhook|setup|install|configure|technical)\b/i,
    // Specific business contexts
    businessContext: /\b(employee|staff|attendance|absenteeism|management|operation|workflow|efficiency)\b/i
  };

  // Define patterns for generic/unmeaningful messages to filter out
  const genericPatterns = {
    // Greetings
    greetings: /^\s*(hi|hello|hey|good|morning|afternoon|evening|howdy|hiya|aloha)\s*$/i,
    // Very short messages
    tooShort: /^\s*\w{1,3}\s*$/i,
    // Typos and single words
    typos: /^\s*(hwllo|hllo|helo|servies|contct|meetng|prcing|purchse|abt|wat|how|wen|wer|why)\s*$/i,
    // Generic single words
    genericWords: /^\s*(yes|no|ok|okay|thanks|thank|please|sorry|bye|goodbye|test|demo|check)\s*$/i,
    // Emojis or special characters only
    specialChars: /^[\s\W]*$/i
  };

  // Extract and filter meaningful user queries with deduplication
  const meaningfulQueries = [];
  const seenQueries = new Set(); // Track unique queries
  const processedMessages = []; // Store all processed meaningful messages

  // First pass: collect all meaningful messages
  for (const msg of userMessages) {
    let query = msg.content.trim();

    // Skip if matches generic patterns
    let isGeneric = false;
    for (const [patternName, pattern] of Object.entries(genericPatterns)) {
      if (pattern.test(query)) {
        console.log(`Filtering out generic message: "${query}" (matches ${patternName})`);
        isGeneric = true;
        break;
      }
    }

    if (isGeneric) continue;

    // Check if message shows business intent or specific inquiry
    let isMeaningful = false;
    let matchedPattern = '';

    for (const [patternName, pattern] of Object.entries(meaningfulPatterns)) {
      if (pattern.test(query)) {
        console.log(`Found meaningful query: "${query}" (matches ${patternName})`);
        isMeaningful = true;
        matchedPattern = patternName;
        break;
      }
    }

    // Also consider longer messages (>15 chars) as potentially meaningful
    if (query.length > 15) {
      isMeaningful = true;
      matchedPattern = 'long_message';
      console.log(`Considering longer message as meaningful: "${query}"`);
    }

    if (isMeaningful) {
      // Clean up the query for display
      query = query.replace(/^[.!?]+|[.!?]+$/g, ''); // Remove leading/trailing punctuation
      query = query.charAt(0).toUpperCase() + query.slice(1); // Capitalize first letter
      query = query.substring(0, 100) + (query.length > 100 ? '...' : ''); // Truncate long messages

      processedMessages.push({
        query,
        pattern: matchedPattern,
        timestamp: msg.timestamp
      });
    }
  }

  // Second pass: select diverse queries (prefer variety over just recency)
  // Group by pattern type to ensure variety
  const queriesByPattern = {};
  for (const msg of processedMessages) {
    if (!queriesByPattern[msg.pattern]) {
      queriesByPattern[msg.pattern] = [];
    }
    queriesByPattern[msg.pattern].push(msg);
  }

  // Select queries from different pattern types to ensure variety
  const selectedQueries = [];
  const patternKeys = Object.keys(queriesByPattern);

  // Round-robin selection to get diverse queries
  let currentIndex = 0;
  while (selectedQueries.length < 4 && currentIndex < processedMessages.length) {
    for (const pattern of patternKeys) {
      if (queriesByPattern[pattern] && queriesByPattern[pattern].length > 0) {
        const query = queriesByPattern[pattern].shift(); // Take first available

        // Skip if we've already seen this exact query
        if (!seenQueries.has(query.query.toLowerCase())) {
          seenQueries.add(query.query.toLowerCase());
          selectedQueries.push(query.query);
          console.log(`Selected diverse query: "${query.query}" (pattern: ${query.pattern})`);
        }
      }

      if (selectedQueries.length >= 4) break;
    }
    currentIndex++;
  }

  // If we still don't have 4 queries, fill with remaining recent ones
  if (selectedQueries.length < 4) {
    for (const msg of processedMessages) {
      if (selectedQueries.length >= 4) break;

      if (!seenQueries.has(msg.query.toLowerCase())) {
        seenQueries.add(msg.query.toLowerCase());
        selectedQueries.push(msg.query);
        console.log(`Added fallback query: "${msg.query}"`);
      }
    }
  }

  const finalQueries = selectedQueries.slice(0, 4);
  console.log('Analytics: Final meaningful queries after deduplication:', finalQueries);

  console.log('Analytics: Final meaningful queries:', meaningfulQueries);

  return finalQueries;
}

// Get User Sessions - OPTIMIZED
async function getSessions(req, res) {
  try {
    const { dateRange = '7days', page = 1, limit = 20 } = req.query;
    const user = await User.findById(req.user.id);

    if (!user) return res.status(404).json({ error: 'User not found' });

    const chatbots = await Chatbot.find({ company: user.company });
    const chatbotIds = chatbots.map(cb => cb._id);

    const now = new Date();
    let startDate;
    switch (dateRange) {
      case '1day': startDate = new Date(now - 24 * 60 * 60 * 1000); break;
      case '7days': startDate = new Date(now - 7 * 24 * 60 * 60 * 1000); break;
      case '30days': startDate = new Date(now - 30 * 24 * 60 * 60 * 1000); break;
      default: startDate = new Date(now - 7 * 24 * 60 * 60 * 1000);
    }

    // Aggregation pipeline to group sessions by user and pagination
    const pipeline = [
      { $match: { chatbotId: { $in: chatbotIds }, createdAt: { $gte: startDate } } },
      // Group by Phone if exists, else Email, else SessionID
      {
        $group: {
          _id: {
            $switch: {
              branches: [
                { case: { $ne: ["$phone", null] }, then: "$phone" },
                { case: { $ne: ["$email", null] }, then: "$email" }
              ],
              default: "$sessionId"
            }
          },
          latestSession: { $first: "$$ROOT" }, // Assuming sort later, but $first is arbitrary without sort
          lastActivityAt: { $max: "$lastActivityAt" },
          totalDuration: { $sum: { $subtract: ["$lastActivityAt", "$startedAt"] } },
          totalSessions: { $sum: 1 },
          allSessionIds: { $push: "$sessionId" }
        }
      },
      { $sort: { lastActivityAt: -1 } },
      {
        $facet: {
          metadata: [{ $count: "total" }],
          data: [
            { $skip: (parseInt(page) - 1) * parseInt(limit) },
            { $limit: parseInt(limit) },
            // Lookup messages for the snippet
            {
              $lookup: {
                from: "messages",
                let: { sessionIds: "$allSessionIds" },
                pipeline: [
                  { $match: { $expr: { $in: ["$sessionId", "$$sessionIds"] } } },
                  { $sort: { createdAt: 1 } },
                  // We need count and last few messages. Since we can't afford fetching all, limits are tricky.
                  // Just get last 5.
                  { $limit: 1000 }, // Optimization cap
                ],
                as: "rawMessages"
              }
            },
            {
              $lookup: {
                from: "phoneusers",
                let: { phone: "$latestSession.phone" },
                pipeline: [
                  { $match: { $expr: { $eq: ["$phone", "$$phone"] } } },
                  { $limit: 1 }
                ],
                as: "phoneUserData"
              }
            },
            { $unwind: { path: "$phoneUserData", preserveNullAndEmptyArrays: true } },
            {
              $lookup: {
                from: "leadcaptures",
                let: { phone: "$latestSession.phone", email: "$latestSession.email" },
                pipeline: [
                  { $match: { $expr: { $or: [{ $eq: ["$phone", "$$phone"] }, { $eq: ["$email", "$$email"] }] } } },
                  { $sort: { createdAt: -1 } },
                  { $limit: 1 }
                ],
                as: "leadData"
              }
            },
            { $unwind: { path: "$leadData", preserveNullAndEmptyArrays: true } },
            {
              $project: {
                _id: 0,
                session_id: "$latestSession.sessionId",
                phone: "$latestSession.phone",
                email: "$latestSession.email",
                name: { $ifNull: ["$latestSession.name", "$phoneUserData.name", "$leadData.name", "Anonymous"] },
                user_type: { $cond: [{ $ifNull: ["$latestSession.phone", false] }, "authenticated", "guest"] },
                session_count: "$totalSessions",
                duration: { $divide: ["$totalDuration", 1000] },
                // Process messages in projection
                messages: { $slice: ["$rawMessages", -5] },
                total_messages: { $size: "$rawMessages" }
              }
            }
          ]
        }
      }
    ];

    const result = await UserSession.aggregate(pipeline);
    const data = result[0].data;
    const total = result[0].metadata[0]?.total || 0;

    // Formatting for frontend compatibility
    const sessionsWithMessages = data.map(group => ({
      ...group,
      messages: group.messages.map(m => ({
        content: m.content,
        sender: m.role,
        role: m.role,
        timestamp: m.createdAt,
      }))
    }));

    res.json({
      success: true,
      data: {
        sessions: sessionsWithMessages,
        avgDurationSeconds: 0, // Simplified for performance
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });

  } catch (error) {
    logger.error('Get sessions error:', error);
    res.status(500).json({ error: 'Failed to get sessions' });
  }
}

// Get Chat History — Phone-Centric Identity: phone first, then session (guest)
async function getChatHistory(req, res) {
  try {
    const { session_id, phone, email } = req.query;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const chatbots = await Chatbot.find({ company: user.company });
    const chatbotIds = chatbots.map(cb => cb._id);

    let query = { chatbotId: { $in: chatbotIds } };

    if (phone) {
      // 🎯 STRICT MODE: Only get messages explicitly tagged with this phone. Guest messages (phone: null) stay hidden.
      query.phone = String(phone).replace(/\D/g, '');
    } else if (session_id) {
      // All messages in this session (full conversation in Top Chats modal / Chat History)
      query.sessionId = session_id;
    } else if (email) {
      // Legacy: fallback to email-based lookup via sessions
      const sessions = await UserSession.find({
        chatbotId: { $in: chatbotIds },
        email: email.toLowerCase(),
      });
      const sessionIds = sessions.map(s => s.sessionId);
      if (sessionIds.length > 0) {
        query.sessionId = { $in: sessionIds };
      } else {
        return res.status(400).json({ error: 'No sessions found for email' });
      }
    } else {
      return res.status(400).json({ error: 'session_id or phone is required' });
    }

    const messages = await Message.find(query).sort({ createdAt: 1 });

    res.json({
      success: true,
      data: {
        messages: messages.map(m => ({
          id: m._id,
          role: m.role,
          content: m.content,
          timestamp: m.createdAt,
          sessionId: m.sessionId,
        })),
        stats: { totalMessages: messages.length },
      },
    });
  } catch (error) {
    logger.error('Get chat history error:', error);
    res.status(500).json({ error: 'Failed to get chat history' });
  }
}

// Enhanced session-based chat history management
async function getChatConversations(req, res) {
  try {
    const {
      page = 1,
      limit = 25,
      dateRange = '30days',
      search,
      phone,
      session_id,
      startDate,
      endDate,
    } = req.query;

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get user's chatbots (for admin dashboard, show all chats from company chatbots)
    const chatbots = await Chatbot.find({ company: user.company });
    const chatbotIds = chatbots.map(cb => cb._id);

    // Build date filter
    let dateFilter = {};
    if (startDate && endDate) {
      dateFilter.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    } else {
      const now = new Date();
      let start;
      switch (dateRange) {
        case '1day':
          start = new Date(now - 24 * 60 * 60 * 1000);
          break;
        case '7days':
          start = new Date(now - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30days':
          start = new Date(now - 30 * 24 * 60 * 60 * 1000);
          break;
        case '90days':
          start = new Date(now - 90 * 24 * 60 * 60 * 1000);
          break;
        case 'all':
          // No date filter
          break;
        default:
          start = new Date(now - 30 * 24 * 60 * 60 * 1000);
      }
      if (start) {
        dateFilter.createdAt = { $gte: start };
      }
    }

    // Build chat query - Phone-Centric: prioritize phone, then session (guest)
    let chatQuery = {
      chatbotId: { $in: chatbotIds },
      ...dateFilter,
    };

    if (phone) {
      chatQuery.phone = String(phone).replace(/\D/g, '');
    } else if (session_id) {
      chatQuery.sessionId = session_id;
    }

    // Get total count for pagination
    const totalChats = await Chat.countDocuments(chatQuery);
    const totalPages = Math.ceil(totalChats / parseInt(limit));
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get chats with pagination
    const chats = await Chat.find(chatQuery)
      .sort({ lastMessageAt: -1 })
      .limit(parseInt(limit))
      .skip(skip)
      .populate('chatbotId', 'name')
      .lean();

    // Get messages for these chats
    const chatIds = chats.map(chat => chat._id);
    const messages = await Message.find({
      chatId: { $in: chatIds },
    }).sort({ createdAt: -1 }).lean();

    // Group messages by chatId
    const messagesByChat = {};
    messages.forEach(msg => {
      if (!messagesByChat[msg.chatId]) {
        messagesByChat[msg.chatId] = [];
      }
      messagesByChat[msg.chatId].push(msg);
    });

    // Get session data for additional metadata
    const sessionIds = chats.map(chat => chat.sessionId);
    const sessions = await UserSession.find({
      sessionId: { $in: sessionIds }
    }).lean();

    const sessionMap = {};
    sessions.forEach(session => {
      sessionMap[session.sessionId] = session;
    });

    // Create conversation objects
    const conversations = chats.map(chat => {
      const chatMessages = messagesByChat[chat._id] || [];
      const sortedMessages = chatMessages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

      const session = sessionMap[chat.sessionId];

      return {
        session_id: chat.sessionId,
        chat_id: chat._id,
        title: chat.title,
        messages: sortedMessages.map(msg => ({
          id: msg._id,
          role: msg.role,
          content: msg.content,
          timestamp: msg.createdAt,
          metadata: {
            contactName: session?.name || chat.phone || session?.phone || session?.email || null,
            phone: chat.phone || session?.phone || null,
            email: session?.email || null,
            isGuest: !session?.phone && !session?.email,
            ipAddress: session?.metadata?.ipAddress || chat.metadata?.ipAddress,
            location: session?.metadata?.location || chat.metadata?.location,
          },
        })),
        firstMessage: sortedMessages[0] ? {
          content: sortedMessages[0].content,
          timestamp: sortedMessages[0].createdAt,
        } : null,
        latestMessageTime: chat.lastMessageAt,
        messageCount: chat.messageCount,
        contact: session?.name || chat.phone || session?.phone || session?.email || (chat.is_guest ? 'Guest' : 'Unknown'),
        phone: chat.phone || session?.phone || null,
        email: session?.email || null,
        is_guest: !session?.phone && !session?.email,
        location: session?.metadata?.location || chat.metadata?.location,
        platform: session?.platform || chat.metadata?.platform || 'web',
        chatbot: chat.chatbotId?.name || 'Unknown Bot',
        tags: chat.tags || [],
      };
    });

    // Apply search filter if provided
    let filteredConversations = conversations;
    if (search) {
      filteredConversations = conversations.filter(conv =>
        conv.messages.some(msg =>
          msg.content.toLowerCase().includes(search.toLowerCase())
        ) ||
        conv.title?.toLowerCase().includes(search.toLowerCase()) ||
        conv.contact?.toLowerCase().includes(search.toLowerCase())
      );
    }

    // Apply phone filter if provided
    if (phone) {
      filteredConversations = filteredConversations.filter(conv =>
        conv.phone && conv.phone.includes(phone.replace(/\D/g, ''))
      );
    }

    res.json({
      success: true,
      data: {
        conversations: filteredConversations,
        pagination: {
          total: totalChats,
          currentPage: parseInt(page),
          totalPages,
          limit: parseInt(limit),
        },
        stats: {
          totalConversations: totalChats,
          filteredCount: filteredConversations.length,
        },
      },
    });
  } catch (error) {
    logger.error('Get chat conversations error:', error);
    res.status(500).json({ error: 'Failed to get chat conversations' });
  }
}

// Get unique contacts (emails and phones) for filtering
async function getContacts(req, res) {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const chatbots = await Chatbot.find({ company: user.company });
    const chatbotIds = chatbots.map(cb => cb._id);

    // Get unique emails from sessions
    const sessionsWithEmails = await UserSession.find({
      chatbotId: { $in: chatbotIds },
      email: { $exists: true, $ne: null }
    }).select('email').lean();

    // Get unique phones from sessions
    const sessionsWithPhones = await UserSession.find({
      chatbotId: { $in: chatbotIds },
      phone: { $exists: true, $ne: null }
    }).select('phone').lean();

    // Extract unique values
    const emails = [...new Set(sessionsWithEmails.map(s => s.email))].filter(Boolean);
    const phones = [...new Set(sessionsWithPhones.map(s => s.phone))].filter(Boolean);

    res.json({
      success: true,
      data: {
        emails,
        phones,
        totalContacts: emails.length + phones.length
      }
    });
  } catch (error) {
    logger.error('Get contacts error:', error);
    res.status(500).json({ error: 'Failed to get contacts' });
  }
}

// Get verified customers (authenticated users with contact info)
async function getCustomers(req, res) {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const chatbots = await Chatbot.find({ company: user.company });
    const chatbotIds = chatbots.map(cb => cb._id);

    // Get all user sessions with contact information belonging to this company's chatbots
    const allSessions = await UserSession.find({
      chatbotId: { $in: chatbotIds },
      $or: [
        { phone: { $exists: true, $ne: null } },
        { email: { $exists: true, $ne: null } }
      ]
    })
      .select('phone email name messageCount startedAt verified verifiedAt chatbotId sessionId')
      .sort({ startedAt: -1 })
      .lean();

    if (allSessions.length === 0) {
      return res.json({ success: true, data: { contacts: [] } });
    }

    // Filter sessions by checking PhoneUser verification status and deduplicate by phone
    const PhoneUser = require('../models/PhoneUser');

    // Get unique phones to batch query PhoneUser
    const uniquePhones = [...new Set(allSessions.map(s => s.phone).filter(Boolean))];

    // Batch query verified PhoneUsers
    const verifiedPhoneUsers = await PhoneUser.find({
      phone: { $in: uniquePhones },
      verified: true
    }).lean();

    const verifiedPhoneMap = new Map(verifiedPhoneUsers.map(u => [u.phone, u]));
    const verifiedCustomersMap = new Map(); // Use Map to deduplicate by phone number

    for (const session of allSessions) {
      if (session.phone && verifiedPhoneMap.has(session.phone)) {
        const phoneUser = verifiedPhoneMap.get(session.phone);
        const key = session.phone;

        // Keep the most recent session for each phone number
        if (!verifiedCustomersMap.has(key)) {
          verifiedCustomersMap.set(key, {
            phone: session.phone,
            email: session.email,
            name: session.name || phoneUser.name || 'User',
            messageCount: session.messageCount || 0,
            firstContact: session.startedAt,
            verified: true,
            verifiedAt: phoneUser.updatedAt || session.startedAt
          });
        }
      }
    }

    // Convert Map to array
    const transformedCustomers = Array.from(verifiedCustomersMap.values());

    // Sort by verified date (most recently verified first)
    transformedCustomers.sort((a, b) => new Date(b.verifiedAt) - new Date(a.verifiedAt));

    res.json({
      success: true,
      data: {
        contacts: transformedCustomers
      }
    });
  } catch (error) {
    logger.error('Get customers error:', error);
    res.status(500).json({ error: 'Failed to get customers' });
  }
}

// Create test verified customers for demo purposes
async function createTestCustomers(req, res) {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const chatbots = await Chatbot.find({ company: user.company });
    if (chatbots.length === 0) {
      return res.status(404).json({ error: 'No chatbots found for this user' });
    }

    const chatbotId = chatbots[0]._id; // Use first chatbot

    // Create test customers
    const testCustomers = [
      {
        sessionId: 'test_verified_customer_1',
        chatbotId: chatbotId,
        phone: '+919876543210',
        email: 'john.doe@example.com',
        name: 'John Doe',
        messageCount: 15,
        verified: true,
        verifiedAt: new Date(),
        startedAt: new Date(Date.now() - 86400000), // 1 day ago
      },
      {
        sessionId: 'test_verified_customer_2',
        chatbotId: chatbotId,
        phone: '+919876543211',
        email: 'jane.smith@example.com',
        name: 'Jane Smith',
        messageCount: 8,
        verified: true,
        verifiedAt: new Date(Date.now() - 3600000), // 1 hour ago
        startedAt: new Date(Date.now() - 172800000), // 2 days ago
      },
      {
        sessionId: 'test_unverified_customer_1',
        chatbotId: chatbotId,
        phone: '+919876543212',
        email: null,
        name: null,
        messageCount: 5,
        verified: false,
        startedAt: new Date(Date.now() - 259200000), // 3 days ago
      }
    ];

    const createdCustomers = [];
    for (const customerData of testCustomers) {
      // Check if customer already exists
      const existing = await UserSession.findOne({
        sessionId: customerData.sessionId,
        chatbotId: chatbotId
      });

      if (!existing) {
        const customer = new UserSession(customerData);
        await customer.save();
        createdCustomers.push(customer);
        console.log('Created test customer:', customerData.sessionId);
      } else {
        console.log('Test customer already exists:', customerData.sessionId);
      }
    }

    res.json({
      success: true,
      message: `Created ${createdCustomers.length} test customers`,
      data: {
        created: createdCustomers.length,
        customers: createdCustomers.map(c => ({
          sessionId: c.sessionId,
          phone: c.phone,
          email: c.email,
          verified: c.verified
        }))
      }
    });
  } catch (error) {
    logger.error('Create test customers error:', error);
    res.status(500).json({ error: 'Failed to create test customers' });
  }
}

// Verify a customer (mark as authenticated)
async function verifyCustomer(req, res) {
  try {
    const { sessionId, phone, email, name } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const chatbots = await Chatbot.find({ company: user.company });
    const chatbotIds = chatbots.map(cb => cb._id);

    // Find the session to verify
    let userSession = await UserSession.findOne({
      sessionId: sessionId,
      chatbotId: { $in: chatbotIds }
    });

    if (!userSession) {
      // Create new session if it doesn't exist
      if (chatbots.length === 0) {
        return res.status(404).json({ error: 'No chatbots found for this user' });
      }

      userSession = new UserSession({
        sessionId,
        chatbotId: chatbots[0]._id,
        phone: phone || null,
        email: email || null,
        name: name || null,
        verified: true,
        verifiedAt: new Date(),
        startedAt: new Date(),
        messageCount: 0
      });
    } else {
      // Update existing session
      userSession.verified = true;
      userSession.verifiedAt = new Date();

      // Update contact info if provided
      if (phone) userSession.phone = phone;
      if (email) userSession.email = email;
      if (name) userSession.name = name;
    }

    await userSession.save();

    console.log('Customer verified successfully:', {
      sessionId,
      phone: userSession.phone,
      email: userSession.email,
      verifiedAt: userSession.verifiedAt
    });

    res.json({
      success: true,
      message: 'Customer verified successfully',
      data: {
        sessionId: userSession.sessionId,
        verified: userSession.verified,
        verifiedAt: userSession.verifiedAt,
        phone: userSession.phone,
        email: userSession.email,
        name: userSession.name
      }
    });
  } catch (error) {
    logger.error('Verify customer error:', error);
    res.status(500).json({ error: 'Failed to verify customer' });
  }
}

// Verify a customer without authentication (for frontend widget)
async function verifyCustomerNoAuth(req, res) {
  try {
    const { sessionId, phone, email, name, chatbotId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    // For now, we'll create/update sessions without strict user validation
    // In production, you'd want proper validation and rate limiting

    let userSession = await UserSession.findOne({ sessionId });

    if (!userSession) {
      // Create new session - try to find a chatbot to associate with
      let targetChatbotId = chatbotId;

      if (!targetChatbotId) {
        // Try to find any chatbot (this is a fallback)
        const anyChatbot = await Chatbot.findOne();
        targetChatbotId = anyChatbot?._id;
      }

      userSession = new UserSession({
        sessionId,
        chatbotId: targetChatbotId,
        phone: phone || null,
        email: email || null,
        name: name || null,
        verified: true,
        verifiedAt: new Date(),
        startedAt: new Date(),
        messageCount: 0
      });
    } else {
      // Update existing session
      userSession.verified = true;
      userSession.verifiedAt = new Date();

      // Update contact info if provided
      if (phone) userSession.phone = phone;
      if (email) userSession.email = email;
      if (name) userSession.name = name;
    }

    await userSession.save();

    console.log('Customer verified (no auth) successfully:', {
      sessionId,
      phone: userSession.phone,
      email: userSession.email,
      verifiedAt: userSession.verifiedAt
    });

    res.json({
      success: true,
      message: 'Customer verified successfully',
      data: {
        sessionId: userSession.sessionId,
        verified: userSession.verified,
        verifiedAt: userSession.verifiedAt,
        phone: userSession.phone,
        email: userSession.email,
        name: userSession.name
      }
    });
  } catch (error) {
    logger.error('Verify customer (no auth) error:', error);
    res.status(500).json({ error: 'Failed to verify customer' });
  }
}

// Get Messages (with filters)
async function getMessages(req, res) {
  try {
    const {
      page = 1,
      limit = 25,
      email,
      phone,
      session_id,
      is_guest,
      dateRange = '30days',
      startDate,
      endDate,
      search,
    } = req.query;

    console.log('getMessages called with:', { session_id, page, limit });

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const chatbots = await Chatbot.find({ company: user.company });
    const chatbotIds = chatbots.map(cb => cb._id);

    // Build date range
    let dateFilter = {};
    if (startDate && endDate) {
      dateFilter.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    } else {
      const now = new Date();
      let start;
      switch (dateRange) {
        case '1day':
          start = new Date(now - 24 * 60 * 60 * 1000);
          break;
        case '7days':
          start = new Date(now - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30days':
          start = new Date(now - 30 * 24 * 60 * 60 * 1000);
          break;
        case 'all':
          start = new Date(0); // Beginning of time
          break;
        default:
          start = new Date(now - 30 * 24 * 60 * 60 * 1000);
      }
      // If session_id is provided, we usually want all messages for that session regardless of date range
      // unless specifically overridden by startDate/endDate
      if (!session_id || (startDate && endDate)) {
        dateFilter.createdAt = { $gte: start };
      }
    }

    // Build query
    let query = {
      chatbotId: { $in: chatbotIds },
      ...dateFilter,
    };

    if (session_id) {
      query.sessionId = session_id;
      console.log('Filtering by session_id:', session_id);
    } else if (phone || email) {
      const phoneDigits = phone ? String(phone).replace(/\D/g, '') : '';
      const orConditions = [];
      if (phoneDigits) {
        orConditions.push({ phone: new RegExp(phoneDigits) });
      }
      if (email) {
        orConditions.push({ email: email.toLowerCase() });
      }

      let sessionIds = [];

      // 1. Find sessions by phone/email (UserSession)
      const sessions = await UserSession.find({
        chatbotId: { $in: chatbotIds },
        ...(orConditions.length > 0 ? { $or: orConditions } : {}),
      });
      sessionIds = [...new Set([...sessionIds, ...sessions.map(s => s.sessionId)])];

      // 2. Find messages with phone matching (Message.phone - partial match)
      if (phoneDigits.length >= 1) {
        const phoneRegex = new RegExp(phoneDigits);
        const messagesByPhone = await Message.find({
          chatbotId: { $in: chatbotIds },
          phone: phoneRegex,
        })
          .select('sessionId')
          .limit(500)
          .lean();
        const extraSessionIds = messagesByPhone.map(m => m.sessionId).filter(Boolean);
        sessionIds = [...new Set([...sessionIds, ...extraSessionIds])];
      }

      // 3. Find chats with phone matching (Chat.phone - partial match)
      if (phoneDigits.length >= 1) {
        const phoneRegex = new RegExp(phoneDigits);
        const chatsByPhone = await Chat.find({
          chatbotId: { $in: chatbotIds },
          phone: phoneRegex,
        })
          .select('sessionId conversationId')
          .limit(500)
          .lean();
        const chatSessionIds = chatsByPhone.map(c => c.sessionId).filter(Boolean);
        const chatConvIds = chatsByPhone.map(c => c.conversationId).filter(Boolean);
        sessionIds = [...new Set([...sessionIds, ...chatSessionIds])];
        if (chatConvIds.length > 0) {
          const msgsByConv = await Message.find({
            chatbotId: { $in: chatbotIds },
            conversationId: { $in: chatConvIds },
          })
            .select('sessionId')
            .limit(500)
            .lean();
          sessionIds = [...new Set([...sessionIds, ...msgsByConv.map(m => m.sessionId).filter(Boolean)])];
        }
      }

      if (sessionIds.length > 0) {
        query.sessionId = { $in: sessionIds };
        console.log('Filtering messages by phone/email session IDs:', sessionIds.length, 'sessions');
      } else if (orConditions.length > 0) {
        query.sessionId = { $in: [] };
      }
    }

    if (search) {
      query.content = { $regex: search, $options: 'i' };
    }

    console.log('Final query:', JSON.stringify(query, null, 2));

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    const total = await Message.countDocuments(query);

    console.log(`Found ${messages.length} messages out of ${total} total for query`);

    // Get session info for messages
    const sessionIds = [...new Set(messages.map(m => m.sessionId))];
    const sessions = await UserSession.find({ sessionId: { $in: sessionIds } });
    const sessionMap = {};
    sessions.forEach(s => {
      sessionMap[s.sessionId] = s;
    });

    const messagesWithSession = messages.map(m => {
      const session = sessionMap[m.sessionId];
      return {
        id: m._id,
        content: m.content,
        sender: m.role,
        role: m.role, // Added for frontend compatibility
        timestamp: m.createdAt,
        session_id: m.sessionId,
        conversation_id: m.conversationId, // Add conversation ID for proper grouping
        email: m.email || session?.email || null,
        phone: m.phone || session?.phone || null,
        is_guest: !m.phone && !session?.phone && !m.email && !session?.email,
        name: (m.phone || session?.phone) ? (m.phone || session.phone) : ((m.email || session?.email) || session?.name || 'Guest'),
      };
    });

    res.json({
      success: true,
      data: {
        messages: messagesWithSession,
        totalPages: Math.ceil(total / parseInt(limit)),
        currentPage: parseInt(page),
        totalMessages: total,
      },
    });
  } catch (error) {
    logger.error('Get messages error:', error);
    res.status(500).json({ error: 'Failed to get messages' });
  }
}

// Get Leads
async function getLeads(req, res) {
  try {
    const { page = 1, limit = 20, searchTerm, dateRange = '30days' } = req.query;
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const chatbots = await Chatbot.find({ company: user.company });
    const chatbotIds = chatbots.map(cb => cb._id);

    // Calculate date range
    const now = new Date();
    let startDate;
    switch (dateRange) {
      case '7days':
        startDate = new Date(now - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30days':
        startDate = new Date(now - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now - 30 * 24 * 60 * 60 * 1000);
    }

    let query = {
      chatbotId: { $in: chatbotIds },
      createdAt: { $gte: startDate },
    };

    if (searchTerm) {
      query.$or = [
        { name: { $regex: searchTerm, $options: 'i' } },
        { email: { $regex: searchTerm, $options: 'i' } },
        { phone: { $regex: searchTerm, $options: 'i' } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const leads = await LeadCapture.find(query)
      .populate('chatbotId', 'name')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    const total = await LeadCapture.countDocuments(query);

    res.json({
      success: true,
      data: {
        leads: leads.map(lead => ({
          id: lead._id,
          name: lead.name,
          email: lead.email,
          phone: lead.phone,
          chatbot: lead.chatbotId?.name || 'Unknown',
          data: lead.data,
          createdAt: lead.createdAt,
        })),
        total,
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    logger.error('Get leads error:', error);
    res.status(500).json({ error: 'Failed to get leads' });
  }
}

// Get User Plan (placeholder)
async function getUserPlan(req, res) {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get real credit data from company
    const company = await Company.findById(user.company);
    const credits = company?.credits || {};

    res.json({
      success: true,
      data: {
        name: 'Basic Plan',
        tokens: credits.total || 0, // Use actual credit balance
        days_remaining: 30,
        max_users: 'Unlimited',
        expiry_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      },
    });
  } catch (error) {
    logger.error('Get user plan error:', error);
    res.status(500).json({ error: 'Failed to get user plan' });
  }
}

// Get User Usage - OPTIMIZED
async function getUserUsage(req, res) {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const chatbots = await Chatbot.find({ company: user.company });
    const chatbotIds = chatbots.map(cb => cb._id);

    const [totalMessages, lastMessage, sessionStats] = await Promise.all([
      Message.countDocuments({ chatbotId: { $in: chatbotIds } }),
      Message.findOne({ chatbotId: { $in: chatbotIds } }).sort({ createdAt: -1 }),
      UserSession.aggregate([
        { $match: { chatbotId: { $in: chatbotIds } } },
        {
          $facet: {
            // Count unique visitors
            uniqueVisitors: [
              {
                $group: {
                  _id: {
                    $switch: {
                      branches: [
                        { case: { $ne: ["$phone", null] }, then: "$phone" }
                      ],
                      default: "$sessionId"
                    }
                  }
                }
              },
              { $count: "count" }
            ],
            // Sum duration
            totalDuration: [
              {
                $group: {
                  _id: null,
                  total: { $sum: { $subtract: ["$lastActivityAt", "$startedAt"] } }
                }
              }
            ]
          }
        }
      ])
    ]);

    const stats = sessionStats[0];
    const uniqueUsers = stats.uniqueVisitors[0]?.count || 0;
    const totalDuration = stats.totalDuration[0]?.total || 0;

    res.json({
      success: true,
      data: {
        total_messages: totalMessages,
        unique_users: uniqueUsers,
        total_duration: Math.floor(totalDuration / 1000), // Convert to seconds
        last_activity: lastMessage?.createdAt || new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Get user usage error:', error);
    res.status(500).json({ error: 'Failed to get user usage' });
  }
}

// Get Dashboard Sidebar Config (placeholder)
async function getDashboardSidebarConfig(req, res) {
  try {
    // Return all available menu keys to show all routes
    res.json({
      success: true,
      data: {
        enabled: true,
        allowed_menu_keys: [
          'dashboard',
          'leads',
          'chat-history',
          'follow-up',
          'customers',
          'chat-summary',
          'analytics',
          'credit-history',
          'send-email',
          'whatsapp-proposals',
          'whatsapp-qr',
          'online-session',
          'banned-sessions',
          'offers'
        ],
      },
    });
  } catch (error) {
    logger.error('Get dashboard sidebar config error:', error);
    res.status(500).json({ error: 'Failed to get dashboard sidebar config' });
  }
}

// Get Collected Leads (same as getLeads but with different filtering)
async function getCollectedLeads(req, res) {
  // Reuse getLeads logic
  return getLeads(req, res);
}

// Get Hot Leads - OPTIMIZED
async function getHotLeads(req, res) {
  try {
    const { page = 1, limit = 20, searchTerm, dateRange, startDate, endDate } = req.query;
    const user = await User.findById(req.user.id);

    if (!user) return res.status(404).json({ error: 'User not found' });

    const chatbots = await Chatbot.find({ company: user.company });
    const chatbotIds = chatbots.map(cb => cb._id);

    // Buying intent keywords
    const buyingKeywords = ['pricing', 'price', 'cost', 'quote', 'demo', 'buy', 'purchase', 'order', 'interested', 'budget'];
    const keywordRegex = buyingKeywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');

    // Date Filter Construction
    const now = new Date();
    let dateFilter = {};
    if (dateRange && dateRange !== 'all') {
      let start;
      switch (dateRange) {
        case '7days': start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break;
        case '30days': start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); break;
        case '90days': start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000); break;
        case 'custom':
          if (startDate) start = new Date(startDate);
          // End date handling would require $lte match
          break;
      }
      if (start) dateFilter.createdAt = { $gte: start };
    }

    // Optimisation: Match messages of interest directly
    const pipeline = [
      {
        $match: {
          chatbotId: { $in: chatbotIds },
          role: { $in: ['user', 'User'] },
          content: { $regex: keywordRegex, $options: 'i' },
          ...dateFilter
        }
      },
      // Group by Session ID to deduplicate multiple hot messages in one session
      {
        $group: {
          _id: "$sessionId",
          lastDetectedAt: { $max: "$createdAt" },
          firstDetectedAt: { $min: "$createdAt" },
          matchedMessages: { $push: { content: "$content", timestamp: "$createdAt" } },
          matchCount: { $sum: 1 },
          chatbotId: { $first: "$chatbotId" }
        }
      },
      // Lookup Session details
      {
        $lookup: {
          from: "usersessions",
          localField: "_id",
          foreignField: "sessionId",
          as: "sessionData"
        }
      },
      { $unwind: { path: "$sessionData", preserveNullAndEmptyArrays: true } },

      // ✅ NEW: Try to fetch name from PhoneUser if missing in session
      {
        $lookup: {
          from: "phoneusers",
          let: { phone: "$sessionData.phone" },
          pipeline: [
            { $match: { $expr: { $eq: ["$phone", "$$phone"] } } },
            { $limit: 1 }
          ],
          as: "phoneUserData"
        }
      },
      { $unwind: { path: "$phoneUserData", preserveNullAndEmptyArrays: true } },

      // ✅ NEW: Try to fetch name from LeadCapture if still missing
      {
        $lookup: {
          from: "leadcaptures",
          let: { phone: "$sessionData.phone", email: "$sessionData.email" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $and: [{ $ne: ["$$phone", null] }, { $eq: ["$phone", "$$phone"] }] },
                    { $and: [{ $ne: ["$$email", null] }, { $eq: ["$email", "$$email"] }] }
                  ]
                }
              }
            },
            { $sort: { createdAt: -1 } },
            { $limit: 1 }
          ],
          as: "leadData"
        }
      },
      { $unwind: { path: "$leadData", preserveNullAndEmptyArrays: true } },

      // Apply Search Term Filter if exists
      ...(searchTerm ? [{
        $match: {
          $or: [
            { "sessionData.name": { $regex: searchTerm, $options: 'i' } },
            { "phoneUserData.name": { $regex: searchTerm, $options: 'i' } },
            { "leadData.name": { $regex: searchTerm, $options: 'i' } },
            { "sessionData.email": { $regex: searchTerm, $options: 'i' } },
            { "sessionData.phone": { $regex: searchTerm, $options: 'i' } }
          ]
        }
      }] : []),
      // Sort, Skip, Limit
      { $sort: { lastDetectedAt: -1 } },
      {
        $facet: {
          metadata: [{ $count: "total" }],
          data: [
            { $skip: (parseInt(page) - 1) * parseInt(limit) },
            { $limit: parseInt(limit) },
            {
              $project: {
                _id: 0,
                session_id: "$_id",
                id: "$sessionData._id",
                name: {
                  $ifNull: [
                    "$sessionData.name",
                    "$phoneUserData.name",
                    "$leadData.name",
                    "Anonymous"
                  ]
                },
                phone: { $ifNull: ["$sessionData.phone", "$phoneUserData.phone", "$leadData.phone"] },
                email: { $ifNull: ["$sessionData.email", "$phoneUserData.email", "$leadData.email"] },
                chatbot: "AI Agent",
                matchedKeywords: { $ifNull: ["$matchedMessages", []] },
                messageSnippets: { $slice: ["$matchedMessages", 3] },
                hotWordCount: "$matchCount",
                firstDetectedAt: 1,
                lastDetectedAt: 1,
                isContacted: { $ifNull: ["$sessionData.metadata.contacted", false] },
                contactedAt: "$sessionData.metadata.contactedAt",
                notes: "$sessionData.metadata.notes"
              }
            }
          ]
        }
      }
    ];

    const result = await Message.aggregate(pipeline);
    const data = result[0].data;
    const total = result[0].metadata[0]?.total || 0;

    // Post-process matchedKeywords to extract just the words for frontend
    const leads = data.map(lead => {
      // Extract keywords from snippets
      const keywords = new Set();
      lead.matchedKeywords.forEach(msg => {
        buyingKeywords.forEach(kw => {
          if (msg.content && msg.content.toLowerCase().includes(kw)) {
            keywords.add(kw);
          }
        });
      });

      return {
        ...lead,
        matchedKeywords: Array.from(keywords),
        id: lead.id || lead.session_id // Enhance ID stability
      };
    });

    res.json({
      success: true,
      data: {
        leads,
        hotWords: buyingKeywords,
        total,
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    logger.error('Get hot leads error:', error);
    res.status(500).json({ error: 'Failed to get hot leads', details: error.message });
  }
}

// Get Daily Summaries (from stored summaries, not real-time generation)
async function getDailySummaries(req, res) {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const DailySummary = require('../models/DailySummary');

    // Get stored summaries for all chatbots in this company, sorted by date (newest first)
    // Get the most recent summary for each chatbot (previous day's summary)
    const chatbots = await Chatbot.find({ company: user.company });
    const chatbotIds = chatbots.map(cb => cb._id);

    // Get the most recent date
    const mostRecentSummary = await DailySummary.findOne({ company: user.company })
      .sort({ date: -1 })
      .limit(1);

    if (!mostRecentSummary) {
      return res.json({
        success: true,
        data: {
          summaries: [],
          total: 0,
          currentPage: 1,
          totalPages: 1
        }
      });
    }

    // Get summaries for all chatbots for the most recent date
    const summaries = await DailySummary.find({
      company: user.company,
      date: mostRecentSummary.date
    })
      .sort({ chatbotName: 1 }); // Sort by chatbot name

    // Format summaries for frontend
    const formattedSummaries = summaries.map(summary => ({
      _id: summary._id,
      date: summary.date.toISOString(),
      summary: summary.summary,
      messageCount: summary.messageCount,
      sessionCount: summary.sessionCount,
      topTopics: summary.topTopics,
      chatbotId: summary.chatbotId,
      chatbotName: summary.chatbotName || 'Unnamed Chatbot',
      generatedAt: summary.generatedAt ? summary.generatedAt.toISOString() : summary.createdAt?.toISOString() || new Date().toISOString()
    }));

    res.json({
      success: true,
      data: {
        summaries: formattedSummaries,
        total: formattedSummaries.length,
        currentPage: 1,
        totalPages: 1
      }
    });
  } catch (error) {
    logger.error('Get daily summaries error:', error);
    res.status(500).json({ error: 'Failed to get daily summaries' });
  }
}

// Extract topics from messages using keyword analysis
function extractTopicsFromMessages(messages) {
  const topicKeywords = {
    'AI capabilities': ['ai', 'artificial intelligence', 'machine learning', 'automation', 'chatbot', 'bot'],
    'employee absenteeism': ['absenteeism', 'absent', 'leave', 'attendance', 'employee', 'staff', 'sick'],
    'customer engagement': ['customer', 'engagement', 'satisfaction', 'interaction', 'support', 'service'],
    'operational efficiency': ['efficiency', 'operations', 'productivity', 'workflow', 'process', 'streamline'],
    'cost management': ['cost', 'budget', 'pricing', 'expense', 'investment', 'roi', 'affordable'],
    'booking system': ['booking', 'reservation', 'appointment', 'schedule', 'calendar'],
    'multilingual support': ['language', 'multilingual', 'translation', 'english', 'hindi', 'spanish'],
    'peak hours': ['peak', 'busy', 'rush', 'high demand', 'traffic', 'overload'],
    'flexible scheduling': ['flexible', 'scheduling', 'shift', 'work hours', 'remote work'],
    'API integration': ['api', 'integration', 'webhook', 'connect', 'third-party']
  };

  const topicCounts = {};
  const messageText = messages.map(m => m.content || '').join(' ').toLowerCase();

  // Count topic occurrences
  Object.entries(topicKeywords).forEach(([topic, keywords]) => {
    const count = keywords.reduce((acc, keyword) => {
      const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
      const matches = messageText.match(regex);
      return acc + (matches ? matches.length : 0);
    }, 0);

    if (count > 0) {
      topicCounts[topic] = count;
    }
  });

  // Return top 6 topics by frequency
  return Object.entries(topicCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6)
    .map(([topic]) => topic);
}

// Generate intelligent daily summary with actual conversation analysis
function generateDailySummary(messages, sessionCount, topics) {
  if (messages.length === 0) {
    return "No conversations were recorded on this day. The chatbot is ready to engage with users and provide assistance.";
  }

  const totalMessages = messages.length;
  const userMessages = messages.filter(m => m.role === 'user' || m.sender === 'user');
  const agentMessages = messages.filter(m => m.role === 'assistant' || m.sender === 'agent');

  // Group messages by session to analyze conversation flows
  const sessionsMap = new Map();
  messages.forEach(msg => {
    if (!sessionsMap.has(msg.sessionId)) {
      sessionsMap.set(msg.sessionId, []);
    }
    sessionsMap.get(msg.sessionId).push(msg);
  });

  // Analyze conversation content
  const conversationInsights = analyzeConversationContent(messages, sessionsMap);

  // Generate comprehensive summary
  let summary = generateComprehensiveSummary(conversationInsights, topics, totalMessages, sessionCount, userMessages.length, agentMessages.length);

  return summary;
}

// Analyze actual conversation content
function analyzeConversationContent(messages, sessionsMap) {
  const insights = {
    mainTopics: [],
    userQuestions: [],
    commonPatterns: [],
    engagementLevel: 'moderate',
    conversationTypes: new Set(),
    businessFocus: [],
    painPoints: [],
    interests: []
  };

  // Extract user messages for content analysis
  const userMessageTexts = messages
    .filter(m => m.role === 'user' || m.sender === 'user')
    .map(m => m.content || '')
    .filter(text => text.length > 0);

  // Analyze conversation patterns
  if (userMessageTexts.length > 0) {
    // Detect question patterns - extract actual question text
    const questions = userMessageTexts.filter(text => {
      const trimmed = text.trim();
      return trimmed.length > 10 && // Only meaningful questions
        (trimmed.includes('?') ||
          trimmed.toLowerCase().match(/\b(what|how|when|where|why|can|could|would|do|does|is|are|tell me|explain|describe)\b/));
    }).map(q => q.trim()).filter(q => q.length > 0);
    insights.userQuestions = questions.slice(0, 10); // Top 10 questions for better analysis

    // Analyze business focus areas
    const businessKeywords = {
      'travel and retail sectors': ['travel', 'retail', 'hospitality', 'tourism', 'shopping', 'store', 'hotel'],
      'pricing and costs': ['price', 'cost', 'budget', 'expensive', 'cheap', 'affordable', 'roi', 'investment', 'budget constraints'],
      'AI capabilities': ['ai', 'artificial intelligence', 'automation', 'chatbot', 'features', 'capabilities', 'speed', 'response time'],
      'customer service': ['customer', 'support', 'service', 'help', 'assistance', 'satisfaction'],
      'operations': ['operations', 'workflow', 'process', 'efficiency', 'productivity', 'streamline'],
      'employee management': ['employee', 'staff', 'attendance', 'absenteeism', 'absent', 'leave', 'workforce'],
      'peak hours management': ['peak', 'busy', 'rush', 'high demand', 'traffic', 'overload'],
      'booking systems': ['booking', 'reservation', 'appointment', 'schedule', 'calendar']
    };

    Object.entries(businessKeywords).forEach(([category, keywords]) => {
      const mentions = userMessageTexts.filter(text =>
        keywords.some(keyword => text.toLowerCase().includes(keyword.toLowerCase()))
      ).length;

      if (mentions > 0) {
        insights.businessFocus.push({ category, mentions });
      }
    });

    // Sort by frequency
    insights.businessFocus.sort((a, b) => b.mentions - a.mentions);
  }

  // Analyze conversation depth
  const avgMessagesPerSession = sessionsMap.size > 0 ? messages.length / sessionsMap.size : 0;
  if (avgMessagesPerSession > 8) {
    insights.engagementLevel = 'high';
  } else if (avgMessagesPerSession < 3) {
    insights.engagementLevel = 'low';
  }

  // Extract main topics from content analysis
  insights.mainTopics = extractDetailedTopics(userMessageTexts);

  return insights;
}

// Extract detailed topics from actual message content
function extractDetailedTopics(userMessages) {
  const topicPatterns = {
    'AI capabilities': /\b(ai|artificial intelligence|automation|chatbot|bot|machine learning|ml|smart|intelligent)\b/i,
    'employee absenteeism': /\b(absenteeism|absent|attendance|leave|employee|staff|workforce|absentee|attendance tracking)\b/i,
    'customer engagement': /\b(customer|engagement|satisfaction|interaction|support|service|help|assistance)\b/i,
    'operational efficiency': /\b(operation|efficiency|productivity|workflow|process|streamline|optimize|automation)\b/i,
    'cost management': /\b(cost|budget|price|pricing|expensive|cheap|affordable|roi|investment|budget constraints)\b/i,
    'booking system': /\b(booking|reservation|appointment|schedule|calendar|meeting|reservation system)\b/i,
    'multilingual support': /\b(multilingual|language|translation|english|hindi|spanish|french|german)\b/i,
    'peak hours': /\b(peak|busy|rush|high demand|traffic|overload|peak time|busy hours)\b/i,
    'flexible scheduling': /\b(flexible|scheduling|shift|work hours|remote work|scheduling system)\b/i,
    'API integration': /\b(api|integration|webhook|connect|third.?party|system integration)\b/i
  };

  const topicCounts = {};

  userMessages.forEach(message => {
    Object.entries(topicPatterns).forEach(([topic, pattern]) => {
      if (pattern.test(message)) {
        topicCounts[topic] = (topicCounts[topic] || 0) + 1;
      }
    });
  });

  // Return top topics by frequency (already in business-friendly format)
  return Object.entries(topicCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6)
    .map(([topic]) => topic);
}

// Generate comprehensive summary in structured business report format
// Format: Key Discussion Topics, Common Questions, Business Insights, Patterns & Trends
function generateComprehensiveSummary(insights, topics, totalMessages, sessionCount, userMsgCount, agentMsgCount) {
  let summary = "";

  // Opening statistics
  summary += `**Daily Conversation Summary**\n\n`;
  summary += `Total Conversations: ${sessionCount} | Total Messages: ${totalMessages} | Average Messages per Conversation: ${Math.round(totalMessages / sessionCount) || 1}\n\n`;

  // 1. 📊 Key Discussion Topics
  summary += `## 📊 Key Discussion Topics\n\n`;

  if (topics.length > 0) {
    topics.slice(0, 8).forEach(topic => {
      summary += `• ${topic}\n`;
    });
  } else if (insights.mainTopics.length > 0) {
    insights.mainTopics.slice(0, 8).forEach(topic => {
      summary += `• ${topic}\n`;
    });
  } else {
    summary += `• General inquiries and support requests\n`;
  }

  // Add business focus areas if available
  if (insights.businessFocus.length > 0) {
    summary += `\n**Primary Business Areas:**\n`;
    insights.businessFocus.slice(0, 5).forEach(area => {
      summary += `• ${area.category} (discussed in ${area.mentions} conversation${area.mentions !== 1 ? 's' : ''})\n`;
    });
  }

  // 2. ❓ Common Questions
  summary += `\n## ❓ Common Questions\n\n`;

  if (insights.userQuestions.length > 0) {
    // Deduplicate and format questions
    const uniqueQuestions = [...new Set(insights.userQuestions.map(q => {
      // Clean and format questions
      let cleaned = q.trim();
      // Remove question marks if at the end, we'll add them consistently
      cleaned = cleaned.replace(/\?+$/, '').trim();
      // Capitalize first letter
      if (cleaned.length > 0) {
        cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
      }
      // Add question mark if it's a question
      if (cleaned.length > 0 && !cleaned.endsWith('?')) {
        // Check if it's a question word
        const questionWords = ['what', 'how', 'when', 'where', 'why', 'who', 'can', 'could', 'would', 'do', 'does', 'is', 'are', 'tell me', 'explain'];
        const isQuestion = questionWords.some(word => cleaned.toLowerCase().startsWith(word));
        if (isQuestion) {
          cleaned += '?';
        }
      }
      return cleaned;
    }))].filter(q => q.length > 10 && q.length < 200); // Filter meaningful questions

    if (uniqueQuestions.length > 0) {
      uniqueQuestions.slice(0, 10).forEach(question => {
        summary += `• ${question}\n`;
      });
    } else {
      summary += `• Users inquired about various topics and features\n`;
    }
  } else {
    summary += `• General inquiries about services and features\n`;
    summary += `• Questions about pricing and availability\n`;
  }

  // 3. 💡 Business Insights
  summary += `\n## 💡 Business Insights\n\n`;

  // Calculate average messages per session for insights
  const avgMessagesPerSession = Math.round(totalMessages / sessionCount) || 1;

  // Analyze gaps and opportunities
  const pricingMentions = insights.businessFocus.find(area =>
    area.category.toLowerCase().includes('pricing') || area.category.toLowerCase().includes('cost')
  );

  if (pricingMentions && pricingMentions.mentions > 2) {
    summary += `• **Pricing Clarity Gap:** Multiple users inquired about pricing, suggesting this information may be difficult to find or unclear. Consider making pricing more prominent or adding a dedicated pricing FAQ.\n`;
  }

  const languageMentions = insights.mainTopics.filter(topic =>
    topic.toLowerCase().includes('language') || topic.toLowerCase().includes('multilingual')
  );
  if (languageMentions.length > 0) {
    summary += `• **Localization Opportunity:** Users showed interest in multilingual support. Consider expanding language options to capture a broader market.\n`;
  }

  if (insights.engagementLevel === 'low' && avgMessagesPerSession < 3) {
    summary += `• **Onboarding Improvement:** Brief conversations suggest users may need clearer initial guidance or more intuitive navigation to find information quickly.\n`;
  } else if (insights.engagementLevel === 'high') {
    summary += `• **Strong Engagement:** Extended conversations indicate users find value in the chatbot. Consider leveraging this engagement for lead qualification or upselling opportunities.\n`;
  }

  // Identify specific opportunities
  if (insights.businessFocus.length > 0) {
    const topArea = insights.businessFocus[0];
    summary += `• **Growth Opportunity:** High interest in "${topArea.category}" presents an opportunity to develop targeted content, features, or marketing campaigns in this area.\n`;
  }

  if (insights.userQuestions.length > 5) {
    summary += `• **FAQ Enhancement:** Multiple recurring questions suggest creating a comprehensive FAQ section could reduce support load and improve user experience.\n`;
  }

  // 4. 📈 Patterns & Trends
  summary += `\n## 📈 Patterns & Trends\n\n`;

  // Behavioral patterns (avgMessagesPerSession already calculated above)
  summary += `**Conversation Patterns:**\n`;
  summary += `• Average conversation length: ${avgMessagesPerSession} message${avgMessagesPerSession !== 1 ? 's' : ''} per session\n`;
  summary += `• Engagement level: ${insights.engagementLevel === 'high' ? 'High - users engage in extended conversations' : insights.engagementLevel === 'low' ? 'Low - users prefer quick, brief interactions' : 'Moderate - balanced interaction pattern'}\n`;

  if (insights.userQuestions.length > 0) {
    summary += `• Question frequency: ${Math.round(insights.userQuestions.length / sessionCount * 10) / 10} questions per conversation on average\n`;
  }

  // Sentiment analysis
  summary += `\n**User Sentiment:**\n`;
  if (insights.engagementLevel === 'high') {
    summary += `• Generally positive and engaged - users are actively exploring features and services\n`;
  } else if (insights.engagementLevel === 'low') {
    summary += `• Efficient and direct - users seek quick answers to specific questions\n`;
  } else {
    summary += `• Balanced - mix of exploratory and task-oriented interactions\n`;
  }

  // Demand trends
  if (insights.businessFocus.length > 0) {
    summary += `\n**Demand Trends:**\n`;
    insights.businessFocus.slice(0, 3).forEach((area, index) => {
      summary += `• ${index + 1}. ${area.category}: ${area.mentions} conversation${area.mentions !== 1 ? 's' : ''}\n`;
    });
  }

  return summary;
}

// Get Top Chats - Phone-Centric: all chats, dedupe by phone or sessionId, last-message by identity
async function getTopChats(req, res) {
  try {
    const { limit = 10 } = req.query;
    const user = await User.findById(req.user.id);

    if (!user) return res.status(404).json({ error: 'User not found' });

    const chatbots = await Chatbot.find({ company: user.company });
    const chatbotIds = chatbots.map(cb => cb._id);

    const pipeline = [
      { $match: { chatbotId: { $in: chatbotIds } } },
      { $sort: { lastMessageAt: -1 } },
      {
        $group: {
          _id: {
            $cond: {
              if: { $and: [{ $ne: ["$phone", null] }, { $gt: [{ $strLenCP: { $ifNull: ["$phone", ""] } }, 0] }] },
              then: "$phone",
              else: "$sessionId"
            }
          },
          doc: { $first: "$$ROOT" }
        }
      },
      { $replaceRoot: { newRoot: "$doc" } },
      { $sort: { lastMessageAt: -1 } },
      { $limit: parseInt(limit) },
      {
        $lookup: {
          from: "messages",
          let: { sid: "$sessionId", phone: "$phone", cbId: "$chatbotId" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $eq: ["$sessionId", "$$sid"] },
                    {
                      $and: [
                        { $ne: ["$$phone", null] },
                        { $gt: [{ $strLenCP: { $ifNull: ["$$phone", ""] } }, 0] },
                        { $eq: ["$phone", "$$phone"] },
                        { $eq: ["$chatbotId", "$$cbId"] }
                      ]
                    }
                  ]
                }
              }
            },
            { $sort: { createdAt: -1 } },
            { $limit: 1 }
          ],
          as: "lastMsg"
        }
      },
      {
        $project: {
          sessionId: 1,
          phone: 1,
          title: {
            $cond: [
              { $and: [{ $ne: ["$phone", null] }, { $gt: [{ $strLenCP: { $ifNull: ["$phone", ""] } }, 0] }] },
              { $concat: ["Phone: ", "$phone"] },
              { $ifNull: ["$title", "Guest"] }
            ]
          },
          lastMessage: { $ifNull: [{ $arrayElemAt: ["$lastMsg.content", 0] }, "No messages"] },
          messageCount: 1,
          duration: { $literal: 0 },
          lastMessageAt: 1
        }
      }
    ];

    const chats = await Chat.aggregate(pipeline);

    res.json({
      success: true,
      data: { chats }
    });

  } catch (error) {
    logger.error('Get top chats error:', error);
    res.status(500).json({ error: 'Failed to get top chats' });
  }
}

// Debug endpoint to check messages (temporary)
async function debugMessages(req, res) {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const chatbots = await Chatbot.find({ company: user.company });
    const chatbotIds = chatbots.map(cb => cb._id);

    const totalMessages = await Message.countDocuments();

    // Get ALL messages to see what's there
    const allMessages = await Message.find({}).sort({ createdAt: -1 }).limit(20);

    const userMessages = await Message.find({
      $or: [
        { role: 'user' },
        { role: /user/i },
        { sender: 'user' },
        { sender: /user/i }
      ]
    }).sort({ createdAt: -1 }).limit(10);

    // Test keyword search
    const keywordMessages = await Message.find({
      content: { $regex: 'contact|proposal|meeting|email|phone', $options: 'i' }
    }).sort({ createdAt: -1 }).limit(10);

    // Test if there are any messages with the followUpKeywords
    const followUpKeywords = [
      'contact number', 'contact', 'number', 'phone', 'call me', 'call',
      'send proposal', 'proposal', 'quote', 'pricing', 'price'
    ];

    let keywordTestMessages = [];
    try {
      const keywordConditions = followUpKeywords.slice(0, 5).map(keyword => ({
        content: { $regex: keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' }
      }));

      keywordTestMessages = await Message.find({
        $or: keywordConditions
      }).sort({ createdAt: -1 }).limit(10);
    } catch (error) {
      console.error('Keyword test failed:', error);
    }

    res.json({
      success: true,
      debug: {
        totalMessages,
        allMessages: allMessages.map(m => ({
          id: m._id,
          sessionId: m.sessionId,
          content: m.content.substring(0, 100),
          role: m.role,
          sender: m.sender,
          chatbotId: m.chatbotId,
          createdAt: m.createdAt
        })),
        userMessages: userMessages.map(m => ({
          sessionId: m.sessionId,
          content: m.content.substring(0, 100),
          role: m.role,
          sender: m.sender,
          chatbotId: m.chatbotId,
          createdAt: m.createdAt
        })),
        keywordMessages: keywordMessages.map(m => ({
          sessionId: m.sessionId,
          content: m.content,
          role: m.role,
          sender: m.sender,
          createdAt: m.createdAt
        })),
        keywordTestMessages: keywordTestMessages.map(m => ({
          sessionId: m.sessionId,
          content: m.content,
          role: m.role,
          sender: m.sender,
          createdAt: m.createdAt
        })),
        chatbotIds,
        userCompany: user.company
      }
    });
  } catch (error) {
    logger.error('Debug messages error:', error);
    res.status(500).json({ error: 'Debug failed', details: error.message });
  }
}

// Mark hot lead as contacted
async function markHotLeadContacted(req, res) {
  try {
    const { sessionId } = req.params;
    const { is_contacted, notes } = req.body;
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Find or create UserSession for this sessionId
    let userSession = await UserSession.findOne({ sessionId });

    if (!userSession) {
      userSession = new UserSession({
        sessionId,
        chatbotId: null,
        lastActivityAt: new Date(),
        messageCount: 0
      });
    }

    // Update metadata
    userSession.metadata = userSession.metadata || {};
    userSession.metadata.contacted = is_contacted;
    if (is_contacted) {
      userSession.metadata.contactedAt = new Date();
    }
    userSession.metadata.notes = notes || '';

    await userSession.save();

    res.json({
      success: true,
      data: {
        success: true,
        lead: {
          session_id: sessionId,
          is_contacted: is_contacted,
          notes: notes || '',
          contactedAt: userSession.metadata.contactedAt
        }
      }
    });
  } catch (error) {
    logger.error('Mark hot lead contacted error:', error);
    res.status(500).json({ error: 'Failed to update hot lead status' });
  }
}

// Mark follow-up lead as contacted
async function markFollowUpContacted(req, res) {
  try {
    const { sessionId } = req.params;
    const { is_contacted, notes } = req.body;

    console.log('markFollowUpContacted called with:', {
      sessionId,
      is_contacted,
      notes,
      sessionIdType: typeof sessionId,
      rawParams: req.params,
      fullUrl: req.originalUrl
    });

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    console.log('User found:', user._id);

    // Find or create UserSession for this sessionId
    console.log('Searching for UserSession with sessionId:', sessionId);
    let userSession = await UserSession.findOne({ sessionId });
    console.log('UserSession search result:', {
      found: !!userSession,
      sessionId: sessionId,
      userSessionId: userSession?._id,
      existingMetadata: userSession?.metadata
    });

    if (!userSession) {
      // Create a new session record if it doesn't exist
      console.log('Creating new UserSession for:', sessionId);
      userSession = new UserSession({
        sessionId,
        chatbotId: null, // We'll update this if we can find it
        lastActivityAt: new Date(),
        messageCount: 0
      });
    }

    // Update metadata
    userSession.metadata = userSession.metadata || {};
    const oldContacted = userSession.metadata.contacted;
    userSession.metadata.contacted = is_contacted;
    if (is_contacted) {
      userSession.metadata.contactedAt = new Date();
    }
    userSession.metadata.notes = notes || '';

    console.log('Updating contact status:', oldContacted, '->', is_contacted);
    const savedSession = await userSession.save();
    console.log('UserSession saved successfully, metadata:', savedSession.metadata);

    res.json({
      success: true,
      data: {
        success: true,
        lead: {
          session_id: sessionId,
          is_contacted: is_contacted,
          notes: notes || '',
          contactedAt: userSession.metadata.contactedAt
        }
      }
    });
  } catch (error) {
    logger.error('Mark follow-up contacted error:', error);
    res.status(500).json({ error: 'Failed to update follow-up status' });
  }
}

// Get Credit Summary
async function getCreditSummary(req, res) {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get real credit data from company
    const company = await Company.findById(user.company);

    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    const credits = company.credits || {};
    const creditSummary = {
      currentBalance: credits.remaining || 0,
      totalAllocated: credits.total || 0,
      totalUsed: credits.used || 0,
      usagePercentage: credits.total > 0 ? Math.round((credits.used || 0) / credits.total * 100) : 0,
      expiresAt: credits.expiresAt,
      // Include other fields for compatibility
      totalCredits: credits.total || 0,
      usedCredits: credits.used || 0,
      remainingCredits: credits.remaining || 0,
    };

    res.json({
      success: true,
      data: creditSummary
    });
  } catch (error) {
    logger.error('Get credit summary error:', error);
    res.status(500).json({ error: 'Failed to get credit summary' });
  }
}

// Get Credit Transactions
async function getCreditTransactions(req, res) {
  try {
    const { page = 1, limit = 50, type, startDate, endDate } = req.query;
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Build query
    const query = { user: user._id };

    if (type && type !== 'all') {
      if (type === 'addition') {
        query.type = { $in: ['admin_add', 'renewal_bonus', 'initial_allocation', 'reset'] };
      } else if (type === 'deduction') {
        query.type = { $in: ['message_deduction', 'admin_remove'] };
      } else {
        query.type = type;
      }
    }

    if (startDate) {
      query.created_at = { ...query.created_at, $gte: new Date(startDate) };
    }
    if (endDate) {
      query.created_at = { ...query.created_at, $lte: new Date(endDate) };
    }

    // Get total count
    const total = await UserCreditTransaction.countDocuments(query);

    // Get transactions with pagination
    const transactions = await UserCreditTransaction.find(query)
      .populate('admin.id', 'name email')
      .sort({ created_at: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit));

    // Get company credit history to include duration information
    const company = await Company.findById(user.company).select('credits.history');
    const companyHistory = company?.credits?.history || [];

    // Format transactions for frontend
    const formattedTransactions = transactions.map(txn => {
      // Find matching entry in company credit history by timestamp (within 1 second tolerance)
      const companyEntry = companyHistory.find(entry => {
        const timeDiff = Math.abs(new Date(entry.timestamp) - new Date(txn.created_at));
        return timeDiff < 1000; // 1 second tolerance
      });

      return {
        id: txn._id,
        type: txn.type,
        amount: txn.amount,
        balance_after: txn.balance_after,
        reason: txn.reason,
        duration: companyEntry?.duration || null,
        session_id: txn.session_id,
        admin: txn.admin?.id ? {
          name: txn.admin.name || 'Admin'
        } : null,
        created_at: txn.created_at
      };
    });

    res.json({
      success: true,
      data: {
        transactions: formattedTransactions,
        total: total,
        totalPages: Math.ceil(total / parseInt(limit)),
        currentPage: parseInt(page)
      }
    });
  } catch (error) {
    logger.error('Get credit transactions error:', error);
    res.status(500).json({ error: 'Failed to get credit transactions' });
  }
}

// Get Email History
async function getEmailHistory(req, res) {
  try {
    const { page = 1, limit = 20 } = req.query;
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Mock email history - in production, you'd have an email log model
    const mockEmails = [
      {
        id: 'email_1',
        to: 'user@example.com',
        subject: 'Welcome to our service',
        status: 'delivered',
        sentAt: new Date(Date.now() - 86400000).toISOString(),
        type: 'welcome'
      },
      {
        id: 'email_2',
        to: 'user@example.com',
        subject: 'Your daily summary',
        status: 'delivered',
        sentAt: new Date(Date.now() - 2 * 86400000).toISOString(),
        type: 'summary'
      }
    ];

    res.json({
      success: true,
      data: {
        emails: mockEmails,
        total: mockEmails.length,
        currentPage: parseInt(page),
        totalPages: Math.ceil(mockEmails.length / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error('Get email history error:', error);
    res.status(500).json({ error: 'Failed to get email history' });
  }
}

// Get WhatsApp Proposal History
async function getWhatsAppProposalHistory(req, res) {
  try {
    const { page = 1, limit = 20 } = req.query;
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Mock WhatsApp proposal history
    const mockProposals = [
      {
        id: 'prop_1',
        phone: '+1234567890',
        status: 'sent',
        sentAt: new Date(Date.now() - 86400000).toISOString(),
        proposalType: 'pricing',
        response: null
      },
      {
        id: 'prop_2',
        phone: '+1234567890',
        status: 'delivered',
        sentAt: new Date(Date.now() - 2 * 86400000).toISOString(),
        proposalType: 'demo',
        response: 'interested'
      }
    ];

    res.json({
      success: true,
      data: {
        proposals: mockProposals,
        total: mockProposals.length,
        currentPage: parseInt(page),
        totalPages: Math.ceil(mockProposals.length / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error('Get WhatsApp proposal history error:', error);
    res.status(500).json({ error: 'Failed to get WhatsApp proposal history' });
  }
}

// Get Follow-up Leads - OPTIMIZED
async function getFollowUpLeads(req, res) {
  try {
    const { page = 1, limit = 20, showContacted = 'all', searchTerm = '', dateRange = 'all', startDate, endDate } = req.query;
    const user = await User.findById(req.user.id);

    if (!user) return res.status(404).json({ error: 'User not found' });

    const chatbots = await Chatbot.find({ company: user.company });
    const chatbotIds = chatbots.map(cb => cb._id);

    const followUpKeywords = [
      'contact number', 'contact', 'number', 'phone', 'call me', 'call',
      'send proposal', 'proposal', 'quote', 'pricing', 'price',
      'schedule meeting', 'meeting', 'demo', 'demo request', 'book meeting',
      'connect', 'lets connect', 'reach out', 'reach me', 'get in touch',
      'interested in', 'interested', 'want to buy', 'want to purchase', 'buy',
      'business type', 'company name', 'organization', 'company',
      'email address', 'email', 'mail', 'my email',
      'whatsapp', 'message', 'text me', 'ping me',
      'follow up', 'callback', 'call back', 'contact me',
      'information', 'details', 'more info', 'tell me more',
      'brochure', 'catalog', 'product info', 'service details'
    ];

    const keywordRegex = followUpKeywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');

    // Date Filter
    const now = new Date();
    let dateFilter = {};
    if (dateRange && dateRange !== 'all') {
      let start;
      switch (dateRange) {
        case '7days': start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break;
        case '30days': start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); break;
        case '90days': start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000); break;
        case 'custom':
          if (startDate) start = new Date(startDate);
          break;
      }
      if (start) dateFilter.createdAt = { $gte: start };
    }

    // Common Base Pipeline (Match -> Group -> Lookup -> Project)
    const basePipeline = [
      // 1. Match relevant messages
      {
        $match: {
          chatbotId: { $in: chatbotIds },
          role: { $in: ['user', 'User'] },
          content: { $regex: keywordRegex, $options: 'i' },
          ...dateFilter
        }
      },
      // 2. Group by Session
      {
        $group: {
          _id: "$sessionId",
          lastDetectedAt: { $max: "$createdAt" },
          firstDetectedAt: { $min: "$createdAt" },
          matchedMessages: { $push: { content: "$content", timestamp: "$createdAt" } },
          matchCount: { $sum: 1 },
          chatbotId: { $first: "$chatbotId" }
        }
      },
      // 3. Lookup Session Data
      {
        $lookup: {
          from: "usersessions",
          localField: "_id",
          foreignField: "sessionId",
          as: "sessionData"
        }
      },
      { $unwind: { path: "$sessionData", preserveNullAndEmptyArrays: true } },

      // ✅ NEW: Try to fetch name from PhoneUser if missing in session
      {
        $lookup: {
          from: "phoneusers",
          let: { phone: "$sessionData.phone" },
          pipeline: [
            { $match: { $expr: { $eq: ["$phone", "$$phone"] } } },
            { $limit: 1 }
          ],
          as: "phoneUserData"
        }
      },
      { $unwind: { path: "$phoneUserData", preserveNullAndEmptyArrays: true } },

      // ✅ NEW: Try to fetch name from LeadCapture if still missing
      {
        $lookup: {
          from: "leadcaptures",
          let: { phone: "$sessionData.phone", email: "$sessionData.email" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $and: [{ $ne: ["$$phone", null] }, { $eq: ["$phone", "$$phone"] }] },
                    { $and: [{ $ne: ["$$email", null] }, { $eq: ["$email", "$$email"] }] }
                  ]
                }
              }
            },
            { $sort: { createdAt: -1 } },
            { $limit: 1 }
          ],
          as: "leadData"
        }
      },
      { $unwind: { path: "$leadData", preserveNullAndEmptyArrays: true } },

      // 4. Project fields
      {
        $project: {
          session_id: "$_id",
          name: {
            $ifNull: [
              "$sessionData.name",
              "$phoneUserData.name",
              "$leadData.name",
              "Anonymous"
            ]
          },
          phone: { $ifNull: ["$sessionData.phone", "$phoneUserData.phone", "$leadData.phone"] },
          email: { $ifNull: ["$sessionData.email", "$phoneUserData.email", "$leadData.email"] },
          matchedKeywords: { $ifNull: ["$matchedMessages", []] },
          messageSnippets: { $slice: ["$matchedMessages", 3] }, // Limit snippets
          firstDetectedAt: 1,
          lastDetectedAt: 1,
          hotWordCount: "$matchCount",
          isContacted: { $ifNull: ["$sessionData.metadata.contacted", false] },
          contactedAt: "$sessionData.metadata.contactedAt",
          notes: "$sessionData.metadata.notes"
        }
      }
    ];

    // Pipeline for Global Stats (independent of status/search filters)
    const statsPipeline = [
      ...basePipeline,
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          pending: { $sum: { $cond: [{ $eq: ["$isContacted", false] }, 1, 0] } },
          contacted: { $sum: { $cond: [{ $eq: ["$isContacted", true] }, 1, 0] } }
        }
      }
    ];

    // Pipeline for Data (with filters and pagination)
    const dataPipeline = [
      ...basePipeline,
      // 5. Apply Filters (Status & Search)
      {
        $match: {
          ...(showContacted !== 'all' ? { isContacted: showContacted === 'contacted' } : {}),
          ...(searchTerm ? {
            $or: [
              { name: { $regex: searchTerm, $options: 'i' } },
              { email: { $regex: searchTerm, $options: 'i' } },
              { phone: { $regex: searchTerm, $options: 'i' } }
            ]
          } : {})
        }
      },
      // 6. Pagination Facet
      { $sort: { lastDetectedAt: -1 } },
      {
        $facet: {
          metadata: [{ $count: "total" }],
          data: [
            { $skip: (parseInt(page) - 1) * parseInt(limit) },
            { $limit: parseInt(limit) }
          ]
        }
      }
    ];

    // Run both aggregations in parallel
    const [statsResult, dataResult] = await Promise.all([
      Message.aggregate(statsPipeline),
      Message.aggregate(dataPipeline)
    ]);

    const globalStats = statsResult[0] || { total: 0, pending: 0, contacted: 0 };
    const dataFacet = dataResult[0]; // dataResult is array of 1 doc from facet
    const leadsData = dataFacet && dataFacet.data ? dataFacet.data : [];
    const totalFiltered = dataFacet && dataFacet.metadata[0] ? dataFacet.metadata[0].total : 0;

    // Process matchedKeywords for frontend (extract keyword strings)
    const leads = leadsData.map(lead => {
      const keywords = new Set();
      lead.matchedKeywords.forEach(msg => {
        followUpKeywords.forEach(kw => {
          if (msg.content && msg.content.toLowerCase().includes(kw)) {
            keywords.add(kw);
          }
        });
      });
      return {
        ...lead,
        matchedKeywords: Array.from(keywords),
        id: lead.session_id
      };
    });

    res.json({
      success: true,
      data: {
        leads,
        keywords: followUpKeywords,
        total: totalFiltered, // This is for pagination
        stats: { // This is for the cards at the top
          total: globalStats.total || 0,
          pending: globalStats.pending || 0,
          contacted: globalStats.contacted || 0,
        },
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalFiltered / parseInt(limit))
      }
    });

  } catch (error) {
    logger.error('Get follow-up leads error:', error);
    res.status(500).json({ error: 'Failed to get follow-up leads', details: error.message });
  }
}

// Get Top Users
async function getTopUsers(req, res) {
  try {
    const { dateRange = '7days', limit = 10 } = req.query;
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const chatbots = await Chatbot.find({ company: user.company });
    const chatbotIds = chatbots.map(cb => cb._id);

    // Calculate date range
    const now = new Date();
    let startDate;
    switch (dateRange) {
      case '7days':
        startDate = new Date(now - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30days':
        startDate = new Date(now - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now - 7 * 24 * 60 * 60 * 1000);
    }

    // Aggregate messages by user identity (phone number or session_id for guests)
    // This prevents split entries when a user authenticates
    const messagePipeline = [
      {
        $match: {
          chatbotId: { $in: chatbotIds },
          createdAt: { $gte: startDate },
        }
      },
      {
        $group: {
          _id: {
            // Group by phone if available, otherwise by sessionId
            userId: {
              $ifNull: ['$phone', '$sessionId']
            },
            userType: {
              $cond: {
                if: { $ne: ['$phone', null] },
                then: 'authenticated',
                else: 'guest'
              }
            }
          },
          messageCount: { $sum: 1 },
          lastMessageAt: { $max: '$createdAt' },
          sessionIds: { $addToSet: '$sessionId' },
          phone: { $first: '$phone' },
          email: { $first: '$email' },
          name: { $first: '$name' },
        }
      },
      {
        $sort: { messageCount: -1 }
      },
      {
        $limit: parseInt(limit)
      }
    ];

    const topUserAggregations = await Message.aggregate(messagePipeline);

    // Get session details for each user
    const topUsers = await Promise.all(
      topUserAggregations.map(async (userAgg) => {
        // Find the most recent session for this user
        const recentSession = await UserSession.findOne({
          sessionId: { $in: userAgg.sessionIds },
          chatbotId: { $in: chatbotIds }
        }).sort({ lastActivityAt: -1 });

        return {
          identifier: userAgg._id.userId,
          identifierType: userAgg._id.userType === 'authenticated' ? 'phone' : 'guest',
          phone: userAgg.phone || null,
          email: userAgg.email || null,
          name: userAgg.name || null,
          messageCount: userAgg.messageCount,
          lastActive: userAgg.lastMessageAt,
          session_id: recentSession ? recentSession.sessionId : userAgg.sessionIds[0],
        };
      })
    );

    res.json({
      success: true,
      data: {
        topUsers,
      },
    });
  } catch (error) {
    logger.error('Get top users error:', error);
    res.status(500).json({ error: 'Failed to get top users' });
  }
}

// Get Unique Emails and Phones
async function getUniqueEmailsAndPhones(req, res) {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const chatbots = await Chatbot.find({ company: user.company });
    const chatbotIds = chatbots.map(cb => cb._id);

    const [emails, phones] = await Promise.all([
      UserSession.distinct('email', {
        chatbotId: { $in: chatbotIds },
        email: { $exists: true, $ne: null },
      }),
      UserSession.distinct('phone', {
        chatbotId: { $in: chatbotIds },
        phone: { $exists: true, $ne: null },
      }),
    ]);

    res.json({
      success: true,
      data: {
        emails: emails.filter(Boolean),
        phones: phones.filter(Boolean),
      },
    });
  } catch (error) {
    logger.error('Get unique emails and phones error:', error);
    res.status(500).json({ error: 'Failed to get unique emails and phones' });
  }
}

// Download User Data (placeholder)
async function downloadUserData(req, res) {
  try {
    // In a real implementation, you'd generate and send a CSV/Excel file
    res.status(501).json({ error: 'Download user data not yet implemented' });
  } catch (error) {
    logger.error('Download user data error:', error);
    res.status(500).json({ error: 'Failed to download user data' });
  }
}

// Download User Report (placeholder)
async function downloadUserReport(req, res) {
  try {
    // In a real implementation, you'd generate and send a PDF report
    res.status(501).json({ error: 'Download user report not yet implemented' });
  } catch (error) {
    logger.error('Download user report error:', error);
    res.status(500).json({ error: 'Failed to download user report' });
  }
}

// Register push notification token
async function registerPushToken(req, res) {
  try {
    const { token, platform } = req.body;
    const userId = req.user.id;

    if (!token) {
      return res.status(400).json({ error: 'Push token is required' });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      {
        pushToken: token,
        pushTokenPlatform: platform || 'android',
      },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    logger.info(`Push token registered for user ${userId}`);
    return res.json({
      success: true,
      message: 'Push token registered successfully',
    });
  } catch (error) {
    logger.error('Register push token error:', error);
    return res.status(500).json({ error: 'Failed to register push token' });
  }
}

module.exports = {
  login,
  logout,
  getCompany,
  getAnalytics,
  getSessions,
  getChatHistory,
  getChatConversations,
  getMessages,
  getContacts,
  getCustomers,
  createTestCustomers,
  verifyCustomer,
  verifyCustomerNoAuth,
  getHotLeads,
  markHotLeadContacted,
  getDailySummaries,
  getTopChats,
  getCreditSummary,
  getCreditTransactions,
  getEmailHistory,
  getWhatsAppProposalHistory,
  getFollowUpLeads,
  markFollowUpContacted,
  debugMessages,
  getLeads,
  getUserPlan,
  getUserUsage,
  getDashboardSidebarConfig,
  getCollectedLeads,
  getTopUsers,
  getUniqueEmailsAndPhones,
  downloadUserData,
  downloadUserReport,
  registerPushToken,
  // Export summary generation functions for scheduler
  extractTopicsFromMessages,
  generateDailySummary,
};

