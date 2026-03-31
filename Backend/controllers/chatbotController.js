const fs = require('fs');
const Chatbot = require('../models/Chatbot');
const Company = require('../models/Company');
const Embedding = require('../models/Embedding');
const Chat = require('../models/Chat');
const Message = require('../models/Message');
const UserSession = require('../models/UserSession');
const LeadCapture = require('../models/LeadCapture');
const VerifiedUser = require('../models/VerifiedUser');
const PhoneUser = require('../models/PhoneUser');
const UserCreditTransaction = require('../models/UserCreditTransaction');
const { chunkText } = require('../utils/textChunker');
const s3Service = require('../services/s3Service');
const logger = require('../config/logging');
const { scheduleKbReseed } = require('../services/kbSuggestionExtractor');

async function getAllChatbots(req, res) {
  try {
    // If JWT auth - check if admin (show all) or user (filter by company)
    // If API key auth - filter by company
    let query = {};

    if (req.user) {
      // JWT authenticated
      if (req.user.type === 'admin') {
        // Admin sees all chatbots
        query = {};
      } else if (req.user.type === 'user' && req.user.companyId) {
        // User sees only their company's chatbots
        query.company = req.user.companyId;
      }
    } else if (req.company) {
      // API key authenticated
      query.company = req.company._id;
    } else {
      // No auth - return empty or require auth
      return res.status(401).json({ error: 'Authentication required' });
    }

    const chatbots = await Chatbot.find(query)
      .populate('company', 'name')
      .sort({ createdAt: -1 });

    console.log('🔍 getAllChatbots - User:', req.user?.id, 'Type:', req.user?.type);
    console.log('🔍 getAllChatbots - Query:', query);
    console.log('🔍 getAllChatbots - Found chatbots:', chatbots.length);

    res.json({
      success: true,
      data: chatbots,
    });
  } catch (error) {
    logger.error('Get all chatbots error:', error);
    res.status(500).json({ error: 'Failed to get chatbots' });
  }
}

async function getChatbot(req, res) {
  try {
    const { id } = req.params;

    const chatbot = await Chatbot.findById(id).populate('company');

    if (!chatbot) {
      return res.status(404).json({ error: 'Chatbot not found' });
    }

    res.json(chatbot);
  } catch (error) {
    logger.error('Get chatbot error:', error);
    res.status(500).json({ error: 'Failed to get chatbot' });
  }
}

async function createChatbot(req, res) {
  try {
    const { companyId, name, initial_credits, ...otherData } = req.body;

    // Determine company ID - from API key auth or from request body (for admin)
    let companyIdToUse;
    if (req.company) {
      // API key authenticated
      companyIdToUse = req.company._id;
    } else if (req.user && req.user.type === 'admin' && companyId) {
      // JWT authenticated admin - companyId from request body
      companyIdToUse = companyId;
    } else {
      return res.status(400).json({ error: 'Company ID is required' });
    }

    // Validate required fields
    if (!name) {
      return res.status(400).json({ error: 'Chatbot name is required' });
    }

    // ✅ DOMAIN INHERITANCE: Inherit company domain for CORS
    let allowedDomains = otherData.settings?.allowedDomains || [];
    let websiteUrl = otherData.websiteUrl;

    try {
      const company = await Company.findById(companyIdToUse).select('domain');
      if (company?.domain) {
        websiteUrl = websiteUrl || company.domain;
        const cleanDomain = company.domain.replace(/^https?:\/\//, '').split('/')[0];
        if (!allowedDomains.includes(cleanDomain)) {
          allowedDomains.push(cleanDomain);
        }
      }
    } catch (err) {
      logger.error('Error inheriting company domain:', err.message);
    }

    const chatbotData = {
      name,
      company: companyIdToUse,
      persona: otherData.persona || 'You are a helpful assistant.',
      websiteUrl,
      settings: {
        ...(otherData.settings || {}),
        allowedDomains
      },
      ...otherData,
    };

    const chatbot = new Chatbot(chatbotData);
    await chatbot.save();

    // Handle initial credits assignment if provided
    if (initial_credits && initial_credits > 0) {
      try {
        // Find the company and add credits
        const company = await Company.findById(companyIdToUse);
        if (company) {
          // Initialize credits if not exists
          if (!company.credits) {
            company.credits = {
              total: 0,
              used: 0,
              remaining: 0,
              history: [],
            };
          }

          // Add credits
          const oldTotal = company.credits.total || 0;
          company.credits.total = oldTotal + initial_credits;
          company.credits.remaining = company.credits.total - (company.credits.used || 0);

          // Add to history
          if (!company.credits.history) {
            company.credits.history = [];
          }
          company.credits.history.push({
            type: 'add',
            amount: initial_credits,
            reason: `Initial credits for chatbot: ${name}`,
            addedBy: req.user?.id || 'system',
            timestamp: new Date(),
          });

          // Create UserCreditTransaction records for all users in the company
          const users = await User.find({ company: companyIdToUse });
          const transactionPromises = users.map(async (user) => {
            // Calculate balance after for this user
            const userTransactions = await UserCreditTransaction.find({ user: user._id }).sort({ created_at: -1 }).limit(1);
            const lastBalance = userTransactions.length > 0 ? userTransactions[0].balance_after : 0;

            return UserCreditTransaction.create({
              user: user._id,
              company: companyIdToUse,
              type: 'initial_allocation',
              amount: Math.floor(initial_credits / users.length), // Distribute credits among users
              balance_after: lastBalance + Math.floor(initial_credits / users.length),
              reason: `Initial credits allocated for chatbot: ${name}`,
              admin: {
                id: req.user?.id || req.company?.name || 'system',
                name: req.user?.name || req.company?.name || 'System'
              }
            });
          });

          await Promise.all(transactionPromises);

          // Mark nested object as modified for Mongoose to save it
          company.markModified('credits');
          await company.save();

          logger.info(`Initial credits added for company ${companyIdToUse}: ${oldTotal} + ${initial_credits} = ${company.credits.total}`);
        }
      } catch (creditError) {
        logger.error('Error assigning initial credits:', creditError);
        // Don't fail the chatbot creation if credit assignment fails
      }
    }

    res.status(201).json({
      success: true,
      data: chatbot,
      message: 'Chatbot created successfully',
    });
  } catch (error) {
    logger.error('Create chatbot error:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: 'Validation error', details: error.message });
    }
    res.status(500).json({ error: 'Failed to create chatbot' });
  }
}

async function updateChatbot(req, res) {
  try {
    const { id } = req.params;

    // Build query based on authentication type
    let query = { _id: id };

    // If authenticated via API key (company), restrict to company's chatbots
    if (req.company) {
      query.company = req.company._id;
    }
    // If authenticated via JWT as admin, allow access to any chatbot
    // (no additional filter needed)

    const chatbot = await Chatbot.findOne(query);

    if (!chatbot) {
      return res.status(404).json({ error: 'Chatbot not found' });
    }

    // Map status to isActive if status is provided
    const updateData = { ...req.body };
    if (updateData.status !== undefined) {
      updateData.isActive = updateData.status === 'active';
      delete updateData.status; // Remove status field as it doesn't exist in the model
    }

    Object.assign(chatbot, updateData);
    await chatbot.save();

    res.json(chatbot);
  } catch (error) {
    logger.error('Update chatbot error:', error);
    res.status(500).json({ error: 'Failed to update chatbot' });
  }
}

async function uploadKnowledge(req, res) {
  try {
    const { id } = req.params;
    const { title, content } = req.body;

    if (!title || !content) {
      return res.status(400).json({ error: 'title and content required' });
    }

    const chatbot = await Chatbot.findById(id);

    if (!chatbot) {
      return res.status(404).json({ error: 'Chatbot not found' });
    }

    // Chunk the content if it's too large
    const embeddingService = require('../services/embeddingService');
    const chunks = chunkText(content);
    logger.info(`Content split into ${chunks.length} chunks`);

    // Generate embeddings for all chunks
    const embeddingPromises = chunks.map(chunk =>
      embeddingService.generateEmbedding(chunk).catch(err => {
        logger.error('Embedding generation error for chunk:', err);
        return null;
      })
    );

    const embeddings = await Promise.all(embeddingPromises);

    // Filter out failed embeddings
    const validChunks = chunks.filter((_, index) => embeddings[index] !== null);
    const validEmbeddings = embeddings.filter(emb => emb !== null);

    if (validChunks.length === 0) {
      return res.status(500).json({ error: 'Failed to generate embeddings for any chunks' });
    }

    // Save all chunks to Embedding collection
    const embeddingDocs = validChunks.map((chunk, index) => ({
      chatbotId: chatbot._id,
      content: chunk,
      embedding: validEmbeddings[index],
      metadata: {
        source: 'manual_upload',
        title: title,
        chunkIndex: index,
      },
    }));

    await Embedding.insertMany(embeddingDocs);
    logger.info(`Saved ${embeddingDocs.length} embedding chunks to database`);

    // Also add to knowledge base for backward compatibility (store first chunk as reference)
    chatbot.knowledgeBase.push({
      title,
      content: validChunks[0], // Store first chunk
      embedding: validEmbeddings[0],
      metadata: {
        source: 'manual_upload',
        uploadedAt: new Date(),
        totalChunks: validChunks.length,
      },
    });

    await chatbot.save();

    scheduleKbReseed(chatbot._id);

    res.json({ success: true, knowledgeItem: chatbot.knowledgeBase[chatbot.knowledgeBase.length - 1] });
  } catch (error) {
    logger.error('Upload knowledge error:', error);
    res.status(500).json({ error: 'Failed to upload knowledge' });
  }
}

async function deleteKnowledge(req, res) {
  try {
    const { id, docId } = req.params;

    const chatbot = await Chatbot.findById(id);

    if (!chatbot) {
      return res.status(404).json({ error: 'Chatbot not found' });
    }

    // Find the knowledge base item to get its metadata for deletion
    const kbItem = chatbot.knowledgeBase.find(kb => kb._id.toString() === docId);

    // Remove from Embedding collection - delete all chunks with matching title
    if (kbItem) {
      const deleteQuery = {
        chatbotId: chatbot._id,
        $or: [
          { 'metadata.title': kbItem.title },
          { 'metadata.filename': kbItem.metadata?.filename },
        ],
      };

      // If we have the original content, also try to match by it (for backward compatibility)
      if (kbItem.content) {
        deleteQuery.$or.push({ content: kbItem.content });
      }

      const deleteResult = await Embedding.deleteMany(deleteQuery);
      logger.info(`Deleted ${deleteResult.deletedCount} embedding chunks for file: ${kbItem.title}`);
    }

    chatbot.knowledgeBase = chatbot.knowledgeBase.filter(
      (kb) => kb._id.toString() !== docId
    );

    await chatbot.save();

    scheduleKbReseed(chatbot._id);

    res.json({ success: true });
  } catch (error) {
    logger.error('Delete knowledge error:', error);
    res.status(500).json({ error: 'Failed to delete knowledge' });
  }
}

async function getChatbotConfig(req, res) {
  try {
    const { id } = req.params;
    const chatbot = await Chatbot.findById(id).select('customization settings name');

    if (!chatbot) {
      return res.status(404).json({ error: 'Chatbot not found' });
    }

    res.json({
      success: true,
      data: {
        customization: chatbot.customization || {},
        settings: chatbot.settings || {},
        name: chatbot.name,
        // Include UI config fields for frontend
        avatar_url: chatbot.settings?.avatar_url || '',
        welcome_text: chatbot.settings?.welcome_text || '',
        welcome_text_enabled: chatbot.settings?.welcome_text_enabled !== undefined ? chatbot.settings.welcome_text_enabled : true,
        welcome_rotating_two_lines: chatbot.settings?.welcome_rotating_two_lines !== false,
        assistant_display_name: chatbot.settings?.assistant_display_name || '',
        assistant_logo_url: chatbot.settings?.assistant_logo_url || '',
        tab_title: chatbot.settings?.tab_title || '',
        favicon_url: chatbot.settings?.favicon_url || '',
        input_placeholders_enabled: chatbot.settings?.input_placeholders_enabled || false,
        input_placeholders: chatbot.settings?.input_placeholders || ["Ask me anything...", "How can I help you?", "What would you like to know?"],
        input_placeholder_speed: chatbot.settings?.input_placeholder_speed || 2.5,
        input_placeholder_animation: chatbot.settings?.input_placeholder_animation || 'typewriter',
        // Include sidebar header config for frontend
        header_text: chatbot.settings?.sidebar?.header?.header_text || '',
        header_logo_url: chatbot.settings?.sidebar?.header?.header_logo_url || '',
        header_logo_link: chatbot.settings?.sidebar?.header?.header_logo_link || '',
        header_enabled: chatbot.settings?.sidebar?.header?.enabled ?? true,
        header_nav_enabled: chatbot.settings?.sidebar?.header?.header_nav_enabled !== false,
        header_nav_items: (() => {
          const raw = chatbot.settings?.sidebar?.header?.header_nav_items;
          if (!Array.isArray(raw)) return [];
          return raw
            .map((x) => ({
              label: String(x?.label || '').trim(),
              prompt: String(x?.prompt || '').trim(),
            }))
            .filter((x) => x.label && x.prompt);
        })(),
        // Include sidebar branding config for frontend
        sidebar_branding: {
          enabled: chatbot.settings?.sidebar?.branding?.enabled || false,
          branding_text: chatbot.settings?.sidebar?.branding?.branding_text || 'OmniAgent',
          branding_company: chatbot.settings?.sidebar?.branding?.branding_company || 'Enterprise',
          branding_logo_url: chatbot.settings?.sidebar?.branding?.branding_logo_url || '',
          branding_logo_link: chatbot.settings?.sidebar?.branding?.branding_logo_link || '',
        },
        whatsapp_number: (chatbot.settings?.sidebar?.whatsapp_number || chatbot.settings?.sidebar?.whatsapp?.url || '').replace('https://wa.me/', '').replace('http://wa.me/', ''),
        whatsapp_text: chatbot.settings?.sidebar?.whatsapp?.text || 'WhatsApp',
        call_number: (chatbot.settings?.sidebar?.call_number || chatbot.settings?.sidebar?.call?.number || ''),
        call_text: chatbot.settings?.sidebar?.call?.text || 'Call Us',
        chat_background: {
          enabled: chatbot.settings?.chat_background?.enabled === true,
          image_url: chatbot.settings?.chat_background?.image_url || '',
          opacity:
            typeof chatbot.settings?.chat_background?.opacity === 'number'
              ? chatbot.settings.chat_background.opacity
              : 10,
          style: ['cover', 'watermark', 'pattern'].includes(chatbot.settings?.chat_background?.style)
            ? chatbot.settings.chat_background.style
            : 'watermark',
        },
      },
    });
  } catch (error) {
    logger.error('Get chatbot config error:', error);
    res.status(500).json({ error: 'Failed to get config' });
  }
}

async function updateChatbotConfig(req, res) {
  try {
    const { id } = req.params;
    const { customization, settings } = req.body;

    // Logging: Log the incoming update request details
    logger.info('📝 [CONFIG UPDATE] Incoming update request:', {
      chatbotId: id,
      customization: !!customization,
      settings: !!settings,
      settingsKeys: settings ? Object.keys(settings) : [],
    });

    const chatbot = await Chatbot.findById(id);
    if (!chatbot) {
      return res.status(404).json({ error: 'Chatbot not found' });
    }

    // Safety: If chatbot.settings is missing, initialize it as {}
    if (!chatbot.settings) {
      chatbot.settings = {};
    }

    // Update Logic: Use dot notation keys and $set for MongoDB updates
    const updateOperations = {};

    // Handle customization updates
    if (customization) {
      Object.keys(customization).forEach(key => {
        updateOperations[`customization.${key}`] = customization[key];
      });
    }

    // Handle settings updates with dot notation
    if (settings) {
      Object.keys(settings).forEach(key => {
        if (key === 'authentication' && typeof settings[key] === 'object') {
          // Handle nested authentication object
          Object.keys(settings[key]).forEach(subKey => {
            updateOperations[`settings.authentication.${subKey}`] = settings[key][subKey];
          });
        } else {
          updateOperations[`settings.${key}`] = settings[key];
        }
      });
    }

    // Use Chatbot.findByIdAndUpdate with { $set: updateOperations }
    if (Object.keys(updateOperations).length > 0) {
      await Chatbot.findByIdAndUpdate(id, { $set: updateOperations });
      logger.info('✅ [CONFIG UPDATE] Applied updates:', updateOperations);
    }

    // Return updated chatbot
    const updatedChatbot = await Chatbot.findById(id);
    res.json({
      success: true,
      data: updatedChatbot,
    });
  } catch (error) {
    logger.error('Update chatbot config error:', error);
    res.status(500).json({ error: 'Failed to update config' });
  }
}

async function deleteChatbot(req, res) {
  try {
    const { id } = req.params;

    // Check permissions - admin can delete any, company can only delete their own
    let query = { _id: id };
    if (req.company) {
      query.company = req.company._id;
    } else if (req.user && req.user.type !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const chatbot = await Chatbot.findOne(query);

    if (!chatbot) {
      return res.status(404).json({ error: 'Chatbot not found' });
    }

    // CASCADE DELETION: Delete all related data before deleting the chatbot
    logger.info(`🗑️ [Chatbot Delete] Starting cascade deletion for chatbot: ${chatbot.name} (${id})`);

    // 1. Delete all embeddings for this chatbot
    const embeddingDelete = await Embedding.deleteMany({ chatbotId: id });
    logger.info(`🗑️ [Chatbot Delete] Deleted ${embeddingDelete.deletedCount} embeddings`);

    // 2. Delete all chats for this chatbot
    const chatDelete = await Chat.deleteMany({ chatbotId: id });
    logger.info(`🗑️ [Chatbot Delete] Deleted ${chatDelete.deletedCount} chats`);

    // 3. Delete all messages for this chatbot
    const messageDelete = await Message.deleteMany({ chatbotId: id });
    logger.info(`🗑️ [Chatbot Delete] Deleted ${messageDelete.deletedCount} messages`);

    // 4. Delete all user sessions for this chatbot
    const sessionDelete = await UserSession.deleteMany({ chatbotId: id });
    logger.info(`🗑️ [Chatbot Delete] Deleted ${sessionDelete.deletedCount} user sessions`);

    // 5. Delete all lead captures for this chatbot
    const leadDelete = await LeadCapture.deleteMany({ chatbotId: id });
    logger.info(`🗑️ [Chatbot Delete] Deleted ${leadDelete.deletedCount} lead captures`);

    // 6. Delete all verified users for this chatbot
    const verifiedUserDelete = await VerifiedUser.deleteMany({ chatbot_id: id });
    logger.info(`🗑️ [Chatbot Delete] Deleted ${verifiedUserDelete.deletedCount} verified users`);

    // 7. Delete all phone users for this chatbot
    const phoneUserDelete = await PhoneUser.deleteMany({ chatbotId: id });
    logger.info(`🗑️ [Chatbot Delete] Deleted ${phoneUserDelete.deletedCount} phone users`);

    // Handle credit cleanup when deleting chatbot
    if (chatbot.company) {
      const company = await Company.findById(chatbot.company);

      if (company) {
        // Find credit allocation for this chatbot
        const creditEntry = company.credits?.history?.find(entry =>
          entry.reason && entry.reason.includes(`Initial credits for chatbot: ${chatbot.name}`)
        );

        // Remove credits from company total if they were allocated
        if (creditEntry && creditEntry.amount > 0) {
          company.credits = company.credits || {};
          company.credits.total = Math.max(0, (company.credits.total || 0) - creditEntry.amount);
          company.credits.remaining = Math.max(0, company.credits.total - (company.credits.used || 0));

          // Clear the expiration date when chatbot is deleted
          company.credits.expiresAt = null;
          console.log(`⏰ [Chatbot Delete] Cleared expiration date for company ${company._id} after deleting chatbot "${chatbot.name}"`);

          // Add removal entry to history
          company.credits.history = company.credits.history || [];
          company.credits.history.push({
            type: 'remove',
            amount: creditEntry.amount,
            reason: `Credits removed due to chatbot deletion: ${chatbot.name}`,
            addedBy: req.user?.id || req.company?.name || 'system',
            timestamp: new Date(),
          });

          await company.save();
        }

        // Delete ALL existing credit transactions for this company to refresh the history
        const deletedTransactions = await UserCreditTransaction.deleteMany({
          company: chatbot.company
        });
        console.log(`Deleted ${deletedTransactions.deletedCount} existing credit transactions for chatbot "${chatbot.name}"`);
      }
    }

    // Finally, delete the chatbot itself
    await Chatbot.findByIdAndDelete(id);
    logger.info(`🗑️ [Chatbot Delete] Successfully deleted chatbot: ${chatbot.name} (${id})`);

    res.json({
      success: true,
      message: 'Chatbot and all related data deleted successfully',
      deletedData: {
        embeddings: embeddingDelete.deletedCount,
        chats: chatDelete.deletedCount,
        messages: messageDelete.deletedCount,
        sessions: sessionDelete.deletedCount,
        leads: leadDelete.deletedCount,
        verifiedUsers: verifiedUserDelete.deletedCount,
        phoneUsers: phoneUserDelete.deletedCount,
      }
    });
  } catch (error) {
    logger.error('Delete chatbot error:', error);
    res.status(500).json({ error: 'Failed to delete chatbot' });
  }
}

async function getChatbotPersona(req, res) {
  try {
    const { id } = req.params;

    let query = { _id: id };
    if (req.company) {
      query.company = req.company._id;
    }

    const chatbot = await Chatbot.findOne(query).select('persona');

    if (!chatbot) {
      return res.status(404).json({ error: 'Chatbot not found' });
    }

    res.json({
      success: true,
      persona: chatbot.persona || 'You are a helpful assistant.',
    });
  } catch (error) {
    logger.error('Get chatbot persona error:', error);
    res.status(500).json({ error: 'Failed to get persona' });
  }
}

async function updateChatbotPersona(req, res) {
  try {
    const { id } = req.params;
    const { persona } = req.body;

    if (persona === undefined) {
      return res.status(400).json({ error: 'Persona is required' });
    }

    let query = { _id: id };
    if (req.company) {
      query.company = req.company._id;
    }

    const chatbot = await Chatbot.findOne(query);

    if (!chatbot) {
      return res.status(404).json({ error: 'Chatbot not found' });
    }

    chatbot.persona = persona || 'You are a helpful assistant.';
    await chatbot.save();

    res.json({
      success: true,
      message: 'Persona updated successfully',
      persona: chatbot.persona,
    });
  } catch (error) {
    logger.error('Update chatbot persona error:', error);
    res.status(500).json({ error: 'Failed to update persona' });
  }
}

// Download Chatbot Data
async function downloadChatbot(req, res) {
  try {
    const { id } = req.params;

    const chatbot = await Chatbot.findById(id).populate('company');
    if (!chatbot) {
      return res.status(404).json({ error: 'Chatbot not found' });
    }

    // Return chatbot data as JSON (in production, you might want to create a ZIP file)
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=chatbot-${id}.json`);
    res.json({
      chatbot,
      exportedAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Download chatbot error:', error);
    res.status(500).json({ error: 'Failed to download chatbot' });
  }
}

// Tab Configuration Methods
async function updateTabConfig(req, res) {
  try {
    const { id } = req.params;
    const { tab_title, favicon_url } = req.body;

    const chatbot = await Chatbot.findById(id);
    if (!chatbot) {
      return res.status(404).json({ error: 'Chatbot not found' });
    }

    // Update directly in settings
    if (!chatbot.settings) chatbot.settings = {};
    chatbot.settings.tab_title = tab_title || '';
    chatbot.settings.favicon_url = favicon_url || '';
    await chatbot.save();

    res.json({
      success: true,
      message: 'Tab config updated successfully',
      tab_title: chatbot.settings.tab_title,
      favicon_url: chatbot.settings.favicon_url
    });
  } catch (error) {
    logger.error('Update tab config error:', error);
    res.status(500).json({ error: 'Failed to update tab config' });
  }
}

// Text Configuration (Welcome Message)
async function updateTextConfig(req, res) {
  try {
    const { id } = req.params;
    const { welcome_text, welcome_text_enabled, welcome_rotating_two_lines } = req.body;

    logger.info(`📝 [TextConfig] Updating welcome text for chatbot ${id}:`, {
      welcome_text: welcome_text?.substring(0, 50),
      welcome_text_enabled,
      welcome_rotating_two_lines,
      hasLayoutKey: Object.prototype.hasOwnProperty.call(req.body, 'welcome_rotating_two_lines'),
    });

    const exists = await Chatbot.findById(id).select('_id').lean();
    if (!exists) {
      return res.status(404).json({ error: 'Chatbot not found' });
    }

    // Use $set so explicit false is persisted (nested doc .save() can drop booleans in some cases)
    const $set = {
      'settings.welcome_text': typeof welcome_text === 'string' ? welcome_text : '',
      'settings.welcome_text_enabled':
        welcome_text_enabled !== undefined ? Boolean(welcome_text_enabled) : true,
    };
    if (Object.prototype.hasOwnProperty.call(req.body, 'welcome_rotating_two_lines')) {
      $set['settings.welcome_rotating_two_lines'] = Boolean(welcome_rotating_two_lines);
    }

    const chatbot = await Chatbot.findByIdAndUpdate(id, { $set }, { new: true });

    const layoutStacked = chatbot.settings?.welcome_rotating_two_lines !== false;

    res.json({
      success: true,
      message: 'Text config updated successfully',
      welcome_text: chatbot.settings?.welcome_text || '',
      welcome_text_enabled: chatbot.settings?.welcome_text_enabled !== false,
      welcome_rotating_two_lines: layoutStacked,
    });
  } catch (error) {
    logger.error('Update text config error:', error);
    res.status(500).json({ error: 'Failed to update text config' });
  }
}

// Assistant Configuration
async function updateAssistantConfig(req, res) {
  try {
    const { id } = req.params;
    const { assistant_display_name, assistant_logo_url, assistant_subtitle } = req.body;

    const chatbot = await Chatbot.findById(id);
    if (!chatbot) {
      return res.status(404).json({ error: 'Chatbot not found' });
    }

    // Update directly in settings
    if (!chatbot.settings) chatbot.settings = {};
    chatbot.settings.assistant_display_name = assistant_display_name || '';
    chatbot.settings.assistant_logo_url = assistant_logo_url || '';
    chatbot.settings.assistant_subtitle = assistant_subtitle || '';
    await chatbot.save();

    res.json({
      success: true,
      message: 'Assistant config updated successfully',
      assistant_display_name: chatbot.settings.assistant_display_name,
      assistant_logo_url: chatbot.settings.assistant_logo_url,
      assistant_subtitle: chatbot.settings.assistant_subtitle
    });
  } catch (error) {
    logger.error('Update assistant config error:', error);
    res.status(500).json({ error: 'Failed to update assistant config' });
  }
}

// Avatar Configuration
async function updateAvatarConfig(req, res) {
  try {
    const { id } = req.params;
    const { avatar_url } = req.body;

    const chatbot = await Chatbot.findById(id);
    if (!chatbot) {
      return res.status(404).json({ error: 'Chatbot not found' });
    }

    // Update directly in settings
    if (!chatbot.settings) chatbot.settings = {};
    chatbot.settings.avatar_url = avatar_url || '';
    await chatbot.save();

    res.json({
      success: true,
      message: 'Avatar config updated successfully',
      avatar_url: chatbot.settings.avatar_url
    });
  } catch (error) {
    logger.error('Update avatar config error:', error);
    res.status(500).json({ error: 'Failed to update avatar config' });
  }
}

// Sidebar Configuration
async function updateSidebarConfig(req, res) {
  try {
    const { id } = req.params;
    const { sidebar_config } = req.body;

    const chatbot = await Chatbot.findById(id);
    if (!chatbot) {
      return res.status(404).json({ error: 'Chatbot not found' });
    }

    // Update directly in settings
    if (!chatbot.settings) chatbot.settings = {};
    if (!chatbot.settings.sidebar) chatbot.settings.sidebar = {};
    chatbot.settings.sidebar = { ...chatbot.settings.sidebar, ...sidebar_config };
    await chatbot.save();

    res.json({
      success: true,
      message: 'Sidebar config updated successfully',
      sidebar: chatbot.settings.sidebar
    });
  } catch (error) {
    logger.error('Update sidebar config error:', error);
    res.status(500).json({ error: 'Failed to update sidebar config' });
  }
}

// Sidebar Branding Configuration
async function updateSidebarBranding(req, res) {
  try {
    const { id } = req.params;
    const { enabled, branding_text, branding_company, branding_logo_url, branding_logo_link } = req.body;

    const chatbot = await Chatbot.findById(id);
    if (!chatbot) {
      return res.status(404).json({ error: 'Chatbot not found' });
    }

    // Update directly in settings
    if (!chatbot.settings) chatbot.settings = {};
    if (!chatbot.settings.sidebar) chatbot.settings.sidebar = {};
    if (!chatbot.settings.sidebar.branding) chatbot.settings.sidebar.branding = {};

    // Only update fields that are provided in the request body
    if (req.body.hasOwnProperty('enabled')) {
      chatbot.settings.sidebar.branding.enabled = enabled;
    }
    if (req.body.hasOwnProperty('branding_text')) {
      chatbot.settings.sidebar.branding.branding_text = branding_text;
    }
    if (req.body.hasOwnProperty('branding_company')) {
      chatbot.settings.sidebar.branding.branding_company = branding_company;
    }
    if (req.body.hasOwnProperty('branding_logo_url')) {
      chatbot.settings.sidebar.branding.branding_logo_url = branding_logo_url;
    }
    if (req.body.hasOwnProperty('branding_logo_link')) {
      chatbot.settings.sidebar.branding.branding_logo_link = branding_logo_link;
    }

    await chatbot.save();

    res.json({
      success: true,
      message: 'Sidebar branding updated successfully',
      branding: chatbot.settings.sidebar.branding
    });
  } catch (error) {
    logger.error('Update sidebar branding error:', error);
    res.status(500).json({ error: 'Failed to update sidebar branding' });
  }
}

// Sidebar Header Configuration Methods
async function updateSidebarHeader(req, res) {
  try {
    const { id } = req.params;
    const { enabled, header_text, header_logo_url, header_logo_link, header_nav_enabled, header_nav_items } = req.body;

    const chatbot = await Chatbot.findById(id);
    if (!chatbot) {
      return res.status(404).json({ error: 'Chatbot not found' });
    }

    if (!chatbot.settings) chatbot.settings = {};
    if (!chatbot.settings.sidebar) chatbot.settings.sidebar = {};
    if (!chatbot.settings.sidebar.header) chatbot.settings.sidebar.header = {};

    // Only update fields that are provided in the request body
    if (req.body.hasOwnProperty('enabled')) {
      chatbot.settings.sidebar.header.enabled = enabled;
    }
    if (req.body.hasOwnProperty('header_text')) {
      chatbot.settings.sidebar.header.header_text = header_text;
    }
    if (req.body.hasOwnProperty('header_logo_url')) {
      chatbot.settings.sidebar.header.header_logo_url = header_logo_url;
    }
    if (req.body.hasOwnProperty('header_logo_link')) {
      chatbot.settings.sidebar.header.header_logo_link = header_logo_link;
    }
    if (req.body.hasOwnProperty('header_nav_enabled')) {
      chatbot.settings.sidebar.header.header_nav_enabled = header_nav_enabled;
    }
    if (req.body.hasOwnProperty('header_nav_items')) {
      const items = Array.isArray(header_nav_items) ? header_nav_items : [];
      chatbot.settings.sidebar.header.header_nav_items = items
        .map((x) => ({
          label: String(x?.label || '').trim(),
          prompt: String(x?.prompt || '').trim(),
        }))
        .filter((x) => x.label && x.prompt);
    }

    chatbot.markModified('settings.sidebar.header');
    chatbot.markModified('settings');

    await chatbot.save();

    res.json({
      success: true,
      message: 'Header sidebar config updated successfully',
      header: chatbot.settings.sidebar.header
    });
  } catch (error) {
    logger.error('Update sidebar header error:', error);
    res.status(500).json({ error: 'Failed to update sidebar header config' });
  }
}

// Sidebar WhatsApp Configuration
async function updateSidebarWhatsApp(req, res) {
  try {
    const { id } = req.params;
    const { enabled, mode, url, text } = req.body;

    const chatbot = await Chatbot.findById(id);
    if (!chatbot) return res.status(404).json({ error: 'Chatbot not found' });

    if (!chatbot.settings) chatbot.settings = {};
    if (!chatbot.settings.sidebar) chatbot.settings.sidebar = {};
    chatbot.settings.sidebar.whatsapp = { enabled, mode, url, text };

    await chatbot.save();
    res.json({ success: true, message: 'WhatsApp sidebar config updated', whatsapp: chatbot.settings.sidebar.whatsapp });
  } catch (error) {
    logger.error('Update sidebar whatsapp error:', error);
    res.status(500).json({ error: 'Failed to update sidebar whatsapp' });
  }
}

// Sidebar Call Configuration
async function updateSidebarCall(req, res) {
  try {
    const { id } = req.params;
    const { enabled, mode, number, text } = req.body;

    const chatbot = await Chatbot.findById(id);
    if (!chatbot) return res.status(404).json({ error: 'Chatbot not found' });

    if (!chatbot.settings) chatbot.settings = {};
    if (!chatbot.settings.sidebar) chatbot.settings.sidebar = {};
    chatbot.settings.sidebar.call = { enabled, mode, number, text };

    await chatbot.save();
    res.json({ success: true, message: 'Call sidebar config updated', call: chatbot.settings.sidebar.call });
  } catch (error) {
    logger.error('Update sidebar call error:', error);
    res.status(500).json({ error: 'Failed to update sidebar call' });
  }
}

// Sidebar Calendly Configuration
async function updateSidebarCalendly(req, res) {
  try {
    const { id } = req.params;
    const { enabled, mode, url, text, pat, eventTypeUri } = req.body;

    const chatbot = await Chatbot.findById(id);
    if (!chatbot) return res.status(404).json({ error: 'Chatbot not found' });

    if (!chatbot.settings) chatbot.settings = {};
    if (!chatbot.settings.sidebar) chatbot.settings.sidebar = {};
    chatbot.settings.sidebar.calendly = { enabled, mode, url, text, pat, eventTypeUri };

    await chatbot.save();
    res.json({ success: true, message: 'Calendly sidebar config updated', calendly: chatbot.settings.sidebar.calendly });
  } catch (error) {
    logger.error('Update sidebar calendly error:', error);
    res.status(500).json({ error: 'Failed to update sidebar calendly' });
  }
}

// Sidebar Email Configuration
async function updateSidebarEmail(req, res) {
  try {
    const { id } = req.params;
    const { enabled, mode, text } = req.body;

    const chatbot = await Chatbot.findById(id);
    if (!chatbot) return res.status(404).json({ error: 'Chatbot not found' });

    if (!chatbot.settings) chatbot.settings = {};
    if (!chatbot.settings.sidebar) chatbot.settings.sidebar = {};
    chatbot.settings.sidebar.email = { enabled, mode, text };

    await chatbot.save();
    res.json({ success: true, message: 'Email sidebar config updated', email: chatbot.settings.sidebar.email });
  } catch (error) {
    logger.error('Update sidebar email error:', error);
    res.status(500).json({ error: 'Failed to update sidebar email' });
  }
}

// Sidebar WhatsApp Proposal Configuration
async function updateSidebarWhatsAppProposal(req, res) {
  try {
    const { id } = req.params;
    const { enabled, display_text, default_api_key, default_org_slug, default_sender_name, default_country_code } = req.body;

    const chatbot = await Chatbot.findById(id);
    if (!chatbot) return res.status(404).json({ error: 'Chatbot not found' });

    if (!chatbot.settings) chatbot.settings = {};
    if (!chatbot.settings.sidebar) chatbot.settings.sidebar = {};
    chatbot.settings.sidebar.whatsapp_proposal = {
      enabled,
      display_text,
      default_api_key,
      default_org_slug,
      default_sender_name,
      default_country_code
    };

    await chatbot.save();
    res.json({ success: true, message: 'WhatsApp Proposal sidebar config updated', whatsapp_proposal: chatbot.settings.sidebar.whatsapp_proposal });
  } catch (error) {
    logger.error('Update sidebar whatsapp proposal error:', error);
    res.status(500).json({ error: 'Failed to update sidebar whatsapp proposal' });
  }
}

// Sidebar Social Configuration
async function updateSidebarSocial(req, res) {
  try {
    const { id } = req.params;
    const { enabled } = req.body;

    const chatbot = await Chatbot.findById(id);
    if (!chatbot) return res.status(404).json({ error: 'Chatbot not found' });

    if (!chatbot.settings) chatbot.settings = {};
    if (!chatbot.settings.sidebar) chatbot.settings.sidebar = {};
    chatbot.settings.sidebar.social = { enabled };

    await chatbot.save();
    res.json({ success: true, message: 'Social sidebar config updated', social: chatbot.settings.sidebar.social });
  } catch (error) {
    logger.error('Update sidebar social error:', error);
    res.status(500).json({ error: 'Failed to update sidebar social' });
  }
}

// Sidebar Custom Nav Configuration
async function updateSidebarCustomNav(req, res) {
  try {
    const { id } = req.params;
    const { enabled } = req.body;

    const chatbot = await Chatbot.findById(id);
    if (!chatbot) return res.status(404).json({ error: 'Chatbot not found' });

    if (!chatbot.settings) chatbot.settings = {};
    if (!chatbot.settings.sidebar) chatbot.settings.sidebar = {};
    chatbot.settings.sidebar.custom_nav = { enabled };

    await chatbot.save();
    res.json({ success: true, message: 'Custom Nav sidebar config updated', custom_nav: chatbot.settings.sidebar.custom_nav });
  } catch (error) {
    logger.error('Update sidebar custom nav error:', error);
    res.status(500).json({ error: 'Failed to update sidebar custom nav' });
  }
}

// Sidebar User Dashboard Configuration
async function updateSidebarUserDashboard(req, res) {
  try {
    const { id } = req.params;
    const { enabled, allowed_menu_keys } = req.body;

    const chatbot = await Chatbot.findById(id);
    if (!chatbot) return res.status(404).json({ error: 'Chatbot not found' });

    if (!chatbot.settings) chatbot.settings = {};
    if (!chatbot.settings.sidebar) chatbot.settings.sidebar = {};

    chatbot.settings.sidebar.user_dashboard_enabled = enabled;
    chatbot.settings.sidebar.user_dashboard_allowed_menu_keys = allowed_menu_keys;

    await chatbot.save();
    res.json({
      success: true,
      message: 'User Dashboard sidebar config updated',
      user_dashboard: {
        enabled: chatbot.settings.sidebar.user_dashboard_enabled,
        allowed_menu_keys: chatbot.settings.sidebar.user_dashboard_allowed_menu_keys
      }
    });
  } catch (error) {
    logger.error('Update sidebar user dashboard error:', error);
    res.status(500).json({ error: 'Failed to update sidebar user dashboard' });
  }
}

// Sidebar Enabled Toggle
async function updateSidebarEnabled(req, res) {
  try {
    const { id } = req.params;
    const { enabled } = req.body;

    const chatbot = await Chatbot.findById(id);
    if (!chatbot) return res.status(404).json({ error: 'Chatbot not found' });

    if (!chatbot.settings) chatbot.settings = {};
    if (!chatbot.settings.sidebar) chatbot.settings.sidebar = {};

    chatbot.settings.sidebar.enabled = enabled;

    await chatbot.save();
    res.json({ success: true, message: 'Sidebar enabled toggle updated', enabled: chatbot.settings.sidebar.enabled });
  } catch (error) {
    logger.error('Update sidebar enabled error:', error);
    res.status(500).json({ error: 'Failed to update sidebar enabled toggle' });
  }
}

// Public chat endpoint for embed scripts
async function chatPublic(req, res) {
  try {
    const { id: chatbotId } = req.params;
    const { message, sessionId } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Get chatbot
    const chatbot = await Chatbot.findById(chatbotId);
    if (!chatbot) {
      return res.status(404).json({ error: 'Chatbot not found' });
    }

    if (!chatbot.isActive) {
      return res.status(400).json({ error: 'Chatbot is currently inactive' });
    }

    // Create or get session
    let session = await UserSession.findOne({ sessionId });
    if (!session) {
      session = await UserSession.create({
        sessionId,
        chatbotId,
        phone: null,
        name: 'Embed User',
        email: null,
      });
    }

    // Save user message
    await Message.create({
      sessionId,
      chatbotId,
      role: 'user',
      content: message,
      language: 'en',
    });

    // Get conversation history (last 10 messages)
    const history = await Message.find({ sessionId })
      .sort({ createdAt: -1 })
      .limit(10)
      .sort({ createdAt: 1 }); // Re-sort to chronological order

    const formattedHistory = history.map(msg => ({
      role: msg.role,
      content: msg.content,
      timestamp: msg.createdAt
    }));

    // Generate AI response using the chat service
    // Correct signature: (query, chatbotId, userId, history, options)
    const { generateStreamingAnswer } = require('../services/chatService');

    let fullResponse = '';
    const historyForPrompt = formattedHistory.slice(0, -1).map(m => ({ role: m.role, content: m.content }));
    for await (const event of generateStreamingAnswer(
      message,
      chatbotId,
      sessionId || 'guest',
      historyForPrompt,
      {}
    )) {
      if (event.type === 'text') {
        fullResponse += event.data;
      }
    }

    // Clean the response
    const cleanedResponse = fullResponse.replace(/\n{3,}/g, '\n\n').trim();

    // Save AI response
    await Message.create({
      sessionId,
      chatbotId,
      role: 'assistant',
      content: cleanedResponse,
      language: 'en',
    });

    res.json({
      success: true,
      data: {
        message: cleanedResponse
      }
    });

  } catch (error) {
    logger.error('Public chat error:', error);
    res.status(500).json({ error: 'Failed to process chat message' });
  }
}

// Placeholder Configuration
async function updatePlaceholdersConfig(req, res) {
  try {
    const { id } = req.params;
    const { placeholders_enabled, placeholders, placeholder_speed, placeholder_animation } = req.body;

    const chatbot = await Chatbot.findById(id);
    if (!chatbot) {
      return res.status(404).json({ error: 'Chatbot not found' });
    }

    // Update directly in settings
    if (!chatbot.settings) chatbot.settings = {};

    // Only update fields that are provided in the request body
    if (req.body.hasOwnProperty('placeholders_enabled')) {
      chatbot.settings.input_placeholders_enabled = placeholders_enabled;
    }
    if (req.body.hasOwnProperty('placeholders')) {
      chatbot.settings.input_placeholders = placeholders;
    }
    if (req.body.hasOwnProperty('placeholder_speed')) {
      chatbot.settings.input_placeholder_speed = placeholder_speed;
    }
    if (req.body.hasOwnProperty('placeholder_animation')) {
      chatbot.settings.input_placeholder_animation = placeholder_animation;
    }

    await chatbot.save();

    res.json({
      success: true,
      message: 'Placeholder config updated successfully',
      data: {
        input_placeholders_enabled: chatbot.settings.input_placeholders_enabled,
        input_placeholders: chatbot.settings.input_placeholders,
        input_placeholder_speed: chatbot.settings.input_placeholder_speed,
        input_placeholder_animation: chatbot.settings.input_placeholder_animation,
      }
    });
  } catch (error) {
    logger.error('Update placeholder config error:', error);
    res.status(500).json({ error: 'Failed to update placeholder config' });
  }
}

// Contact Configuration
const updateContactConfig = async (req, res) => {
  try {
    const { id } = req.params;
    const { whatsapp_number, call_number } = req.body;

    const chatbot = await Chatbot.findById(id);
    if (!chatbot) {
      return res.status(404).json({
        success: false,
        error: 'Chatbot not found',
      });
    }

    // Ensure settings and sidebar objects exist
    if (!chatbot.settings) chatbot.settings = {};
    if (!chatbot.settings.sidebar) chatbot.settings.sidebar = {};

    chatbot.settings.sidebar.whatsapp_number = whatsapp_number;
    chatbot.settings.sidebar.call_number = call_number;

    await chatbot.save();

    res.json({
      success: true,
      message: 'Contact configuration updated successfully',
      data: {
        whatsapp_number: chatbot.settings.sidebar.whatsapp_number,
        call_number: chatbot.settings.sidebar.call_number,
      },
    });
  } catch (error) {
    console.error('❌ [Chatbot] Error updating contact config:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message,
    });
  }
};

// Get current sidebar configuration
async function getChatbotSidebarConfig(req, res) {
  try {
    const { id } = req.params;
    const chatbot = await Chatbot.findById(id);

    if (!chatbot) {
      return res.status(404).json({ error: 'Chatbot not found' });
    }

    // Default configuration if not present
    const sidebarConfig = chatbot.settings?.sidebar || {
      enabled: false,
      user_dashboard_allowed_menu_keys: [],
      whatsapp: { enabled: false, mode: 'link', url: '', text: '' },
      call: { enabled: false, mode: 'link', number: '', text: '' },
      calendly: { enabled: false, mode: 'link', url: '', text: '', pat: '', eventTypeUri: '' },
      email: { enabled: false, mode: 'link', text: '' },
      whatsapp_proposal: { enabled: false, display_text: 'Get Quote', default_api_key: '', default_org_slug: '', default_sender_name: '', default_country_code: '' },
      social: { enabled: false },
      branding: { enabled: false, branding_text: 'Powered by', branding_company: 'Troika Tech', branding_logo_url: '', branding_logo_link: '' },
      header: { enabled: false, header_text: '', header_logo_url: '', header_logo_link: '' },
      custom_nav: { enabled: false },
      whatsapp_number: '',
      call_number: ''
    };

    res.json({
      success: true,
      data: sidebarConfig
    });
  } catch (error) {
    logger.error('Get sidebar config error:', error);
    res.status(500).json({ error: 'Failed to get sidebar configuration' });
  }
}

// ==================== Custom Navigation Items ====================

/**
 * Get all custom navigation items for a chatbot
 */
async function getCustomNavigationItems(req, res) {
  try {
    const chatbot = await Chatbot.findById(req.params.id);
    if (!chatbot) {
      return res.status(404).json({ error: 'Chatbot not found' });
    }

    const items = chatbot.settings?.sidebar?.custom_nav?.items || [];
    // Sort by order
    const sortedItems = [...items].sort((a, b) => (a.order || 0) - (b.order || 0));

    res.json({
      success: true,
      data: {
        enabled: chatbot.settings?.sidebar?.custom_nav?.enabled || false,
        items: sortedItems,
      },
    });
  } catch (error) {
    logger.error('Get custom navigation items error:', error);
    res.status(500).json({ error: 'Failed to get custom navigation items' });
  }
}

/**
 * Create a new custom navigation item
 */
async function createCustomNavigationItem(req, res) {
  try {
    const { display_text, icon_name, redirect_url, is_active, order } = req.body;

    if (!display_text || !icon_name || !redirect_url) {
      return res.status(400).json({ error: 'display_text, icon_name, and redirect_url are required' });
    }

    const chatbot = await Chatbot.findById(req.params.id);
    if (!chatbot) {
      return res.status(404).json({ error: 'Chatbot not found' });
    }

    // Initialize custom_nav if not exists
    if (!chatbot.settings.sidebar) {
      chatbot.settings.sidebar = {};
    }
    if (!chatbot.settings.sidebar.custom_nav) {
      chatbot.settings.sidebar.custom_nav = { enabled: false, items: [] };
    }
    if (!chatbot.settings.sidebar.custom_nav.items) {
      chatbot.settings.sidebar.custom_nav.items = [];
    }

    const newItem = {
      display_text,
      icon_name,
      redirect_url,
      is_active: is_active !== undefined ? is_active : true,
      order: order !== undefined ? order : chatbot.settings.sidebar.custom_nav.items.length,
    };

    chatbot.settings.sidebar.custom_nav.items.push(newItem);
    chatbot.markModified('settings');
    await chatbot.save();

    // Get the newly created item (last one)
    const createdItem = chatbot.settings.sidebar.custom_nav.items[chatbot.settings.sidebar.custom_nav.items.length - 1];

    logger.info(`✅ Custom navigation item created for chatbot ${req.params.id}`);
    res.status(201).json({
      success: true,
      message: 'Custom navigation item created successfully',
      data: createdItem,
    });
  } catch (error) {
    logger.error('Create custom navigation item error:', error);
    res.status(500).json({ error: 'Failed to create custom navigation item' });
  }
}

/**
 * Update a custom navigation item
 */
async function updateCustomNavigationItem(req, res) {
  try {
    const { itemId } = req.params;
    const { display_text, icon_name, redirect_url, is_active, order } = req.body;

    const chatbot = await Chatbot.findById(req.params.id);
    if (!chatbot) {
      return res.status(404).json({ error: 'Chatbot not found' });
    }

    const items = chatbot.settings?.sidebar?.custom_nav?.items || [];
    const itemIndex = items.findIndex(item => item._id.toString() === itemId);

    if (itemIndex === -1) {
      return res.status(404).json({ error: 'Custom navigation item not found' });
    }

    // Update fields
    if (display_text !== undefined) items[itemIndex].display_text = display_text;
    if (icon_name !== undefined) items[itemIndex].icon_name = icon_name;
    if (redirect_url !== undefined) items[itemIndex].redirect_url = redirect_url;
    if (is_active !== undefined) items[itemIndex].is_active = is_active;
    if (order !== undefined) items[itemIndex].order = order;

    chatbot.markModified('settings');
    await chatbot.save();

    logger.info(`✅ Custom navigation item ${itemId} updated for chatbot ${req.params.id}`);
    res.json({
      success: true,
      message: 'Custom navigation item updated successfully',
      data: items[itemIndex],
    });
  } catch (error) {
    logger.error('Update custom navigation item error:', error);
    res.status(500).json({ error: 'Failed to update custom navigation item' });
  }
}

/**
 * Delete a custom navigation item
 */
async function deleteCustomNavigationItem(req, res) {
  try {
    const { itemId } = req.params;

    const chatbot = await Chatbot.findById(req.params.id);
    if (!chatbot) {
      return res.status(404).json({ error: 'Chatbot not found' });
    }

    const items = chatbot.settings?.sidebar?.custom_nav?.items || [];
    const itemIndex = items.findIndex(item => item._id.toString() === itemId);

    if (itemIndex === -1) {
      return res.status(404).json({ error: 'Custom navigation item not found' });
    }

    items.splice(itemIndex, 1);
    chatbot.markModified('settings');
    await chatbot.save();

    logger.info(`✅ Custom navigation item ${itemId} deleted from chatbot ${req.params.id}`);
    res.json({
      success: true,
      message: 'Custom navigation item deleted successfully',
    });
  } catch (error) {
    logger.error('Delete custom navigation item error:', error);
    res.status(500).json({ error: 'Failed to delete custom navigation item' });
  }
}

/**
 * Get Embed Script for a chatbot
 * Returns the HTML script tag that can be embedded in any website
 */
async function getEmbedScript(req, res) {
  try {
    const { id } = req.params;

    const chatbot = await Chatbot.findById(id).select('name');
    if (!chatbot) {
      return res.status(404).json({ error: 'Chatbot not found' });
    }

    // Determine the base URL from environment or request
    const protocol = req.protocol;
    const host = req.get('host');
    const baseUrl = process.env.API_BASE_URL || `${protocol}://${host}`;

    // Build the script URLs
    const loaderUrl = `${baseUrl}/chatbot-loader/fullscreen-loader.js`;
    const bundleUrl = `${baseUrl}/chatbot-loader/chatbot-fullscreen-bundle.js`;
    const apiBase = `${baseUrl}/api`;

    // Generate the embed script
    const script = `<script
  src="${loaderUrl}"
  chatbot-id="${id}"
  api-base="${apiBase}"
  bundle-url="${bundleUrl}"
></script>`;

    res.json({
      success: true,
      data: {
        script,
        chatbotId: id,
        chatbotName: chatbot.name,
        apiBase,
        loaderUrl,
        bundleUrl,
        instructions: 'Copy the script above and paste it before the closing </body> tag in your HTML file. The chatbot will appear as a fullscreen interface when the page loads.',
      },
    });
  } catch (error) {
    logger.error('Get embed script error:', error);
    res.status(500).json({ error: 'Failed to generate embed script' });
  }
}

// Product Images Configuration (S3)
async function getProductImagesUploadUrl(req, res) {
  try {
    const { id } = req.params;
    const { filename, contentType } = req.body;

    if (!filename || !contentType) {
      return res.status(400).json({ error: 'Filename and content type are required' });
    }

    const chatbot = await Chatbot.findById(id);
    if (!chatbot) {
      return res.status(404).json({ error: 'Chatbot not found' });
    }

    // Generate a unique key for the file
    const timestamp = Date.now();
    const cleanFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const key = `product-images/${chatbot._id}/${timestamp}_${cleanFilename}`;

    const { uploadUrl, key: s3Key } = await s3Service.getPresignedUploadUrl(key, contentType);

    res.json({
      success: true,
      uploadUrl,
      key: s3Key,
      // Helper URL for frontend to display (assuming public access or cloudfront)
      // If bucket is public read:
      publicUrl: `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_S3_REGION}.amazonaws.com/${s3Key}`
    });
  } catch (error) {
    logger.error('Get product images upload URL error:', error);
    res.status(500).json({ error: 'Failed to generate upload URL' });
  }
}

async function updateChatBackgroundConfig(req, res) {
  try {
    const { id } = req.params;
    const { enabled, image_url, opacity, style } = req.body;

    const chatbot = await Chatbot.findById(id);
    if (!chatbot) {
      return res.status(404).json({ error: 'Chatbot not found' });
    }

    if (!chatbot.settings) chatbot.settings = {};
    if (!chatbot.settings.chat_background) chatbot.settings.chat_background = {};

    chatbot.settings.chat_background.enabled = enabled === true;
    chatbot.settings.chat_background.image_url = typeof image_url === 'string' ? image_url : '';
    const op = Number(opacity);
    chatbot.settings.chat_background.opacity = Number.isFinite(op) ? Math.min(80, Math.max(5, op)) : 10;
    const st = style === 'watermark' || style === 'pattern' ? style : 'cover';
    chatbot.settings.chat_background.style = st;

    await chatbot.save();

    res.json({
      success: true,
      message: 'Chat background updated successfully',
      chat_background: chatbot.settings.chat_background,
    });
  } catch (error) {
    logger.error('Update chat background config error:', error);
    res.status(500).json({ error: 'Failed to update chat background' });
  }
}

/**
 * POST multipart (field name: file) — saves image on API disk and returns a public URL.
 * No S3 required. Set PUBLIC_API_URL in production if the API is behind a reverse proxy
 * and req Host/protocol would be wrong (e.g. internal http).
 */
async function uploadChatBackgroundFile(req, res) {
  try {
    const { id } = req.params;
    if (!req.file) {
      return res.status(400).json({ error: 'File is required' });
    }

    const chatbot = await Chatbot.findById(id);
    if (!chatbot) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (_) {}
      return res.status(404).json({ error: 'Chatbot not found' });
    }

    const relative = `${id}/${req.file.filename}`;
    const base = (process.env.PUBLIC_API_URL || '').replace(/\/$/, '');
    const publicUrl = base
      ? `${base}/uploads/chat-backgrounds/${relative}`
      : `${req.protocol}://${req.get('host')}/uploads/chat-backgrounds/${relative}`;

    res.json({
      success: true,
      publicUrl,
      key: relative,
    });
  } catch (error) {
    logger.error('Chat background direct upload error:', error);
    if (req.file?.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (_) {}
    }
    res.status(500).json({ error: 'Failed to upload image' });
  }
}

async function getChatBackgroundUploadUrl(req, res) {
  try {
    const { id } = req.params;
    const { filename, contentType } = req.body;

    if (!filename || !contentType) {
      return res.status(400).json({ error: 'Filename and content type are required' });
    }

    if (!contentType.startsWith('image/')) {
      return res.status(400).json({ error: 'Only image uploads are allowed' });
    }

    if (!process.env.AWS_S3_ACCESS_KEY_ID || !process.env.AWS_S3_SECRET_ACCESS_KEY || !process.env.AWS_S3_BUCKET_NAME) {
      logger.error('Chat background upload: S3 env vars missing');
      return res.status(503).json({
        error: 'File upload is not configured. Set AWS_S3_ACCESS_KEY_ID, AWS_S3_SECRET_ACCESS_KEY, and AWS_S3_BUCKET_NAME on the server.',
      });
    }

    const chatbot = await Chatbot.findById(id);
    if (!chatbot) {
      return res.status(404).json({ error: 'Chatbot not found' });
    }

    const timestamp = Date.now();
    const cleanFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const key = `chat-backgrounds/${chatbot._id}/${timestamp}_${cleanFilename}`;

    const { uploadUrl, key: s3Key } = await s3Service.getPresignedUploadUrl(key, contentType);

    res.json({
      success: true,
      uploadUrl,
      key: s3Key,
      publicUrl: `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_S3_REGION}.amazonaws.com/${s3Key}`,
    });
  } catch (error) {
    logger.error('Get chat background upload URL error:', error);
    res.status(500).json({ error: 'Failed to generate upload URL' });
  }
}

async function updateProductImagesConfig(req, res) {
  try {
    const { id } = req.params;
    const { enabled, main_keyword, images, newImages } = req.body;

    const chatbot = await Chatbot.findById(id);
    if (!chatbot) {
      return res.status(404).json({ error: 'Chatbot not found' });
    }

    if (!chatbot.settings) chatbot.settings = {};
    if (!chatbot.settings.product_images) chatbot.settings.product_images = {};

    // Update fields if provided
    if (enabled !== undefined) chatbot.settings.product_images.enabled = enabled;
    if (main_keyword !== undefined) chatbot.settings.product_images.main_keyword = main_keyword;

    // "images" is the full list of current images (metadata)
    // "newImages" is optional, if we want to append (but full list replacement "images" is safer for UI state sync)

    if (images && Array.isArray(images)) {
      chatbot.settings.product_images.images = images.map(img => ({
        url: img.url,
        name: img.name || '',
        keywords: Array.isArray(img.keywords) ? img.keywords : [],
        uploadDate: img.uploadDate || new Date()
      }));
    }

    await chatbot.save();

    res.json({
      success: true,
      message: 'Product images config updated successfully',
      product_images: chatbot.settings.product_images
    });
  } catch (error) {
    logger.error('Update product images config error:', error);
    res.status(500).json({ error: 'Failed to update product images config' });
  }
}


module.exports = {
  getAllChatbots,
  getChatbot,
  createChatbot,
  updateChatbot,
  deleteChatbot,
  uploadKnowledge,
  deleteKnowledge,
  getChatbotConfig,
  getChatbotSidebarConfig,
  updateChatbotConfig,
  getChatbotPersona,
  updateChatbotPersona,
  downloadChatbot,
  updateTabConfig,
  updateTextConfig,
  updateAssistantConfig,
  updateAvatarConfig,
  updateSidebarConfig,
  updateSidebarBranding,
  updateSidebarHeader,
  updateSidebarWhatsApp,
  updateSidebarCall,
  updateSidebarCalendly,
  updateSidebarEmail,
  updateSidebarWhatsAppProposal,
  updateSidebarSocial,
  updateSidebarCustomNav,
  updateSidebarUserDashboard,
  updateSidebarEnabled,
  updatePlaceholdersConfig,
  updateContactConfig,
  chatPublic,
  getCustomNavigationItems,
  createCustomNavigationItem,
  updateCustomNavigationItem,
  deleteCustomNavigationItem,
  getEmbedScript,
  getProductImagesUploadUrl,
  updateProductImagesConfig,
  updateChatBackgroundConfig,
  uploadChatBackgroundFile,
  getChatBackgroundUploadUrl,
};

