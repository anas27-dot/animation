const Company = require('../models/Company');
const Chatbot = require('../models/Chatbot');
const User = require('../models/User');
const Message = require('../models/Message');
const UserSession = require('../models/UserSession');
const Chat = require('../models/Chat');
const Embedding = require('../models/Embedding');
const LeadCapture = require('../models/LeadCapture');
const VerifiedUser = require('../models/VerifiedUser');
const PhoneUser = require('../models/PhoneUser');
const UserCreditTransaction = require('../models/UserCreditTransaction');
const logger = require('../config/logging');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const emailService = require('../services/emailService');

/**
 * Replaces placeholders in the format {Placeholder Name} with actual values.
 * @param {string} template - The template string containing placeholders.
 * @param {Object} data - The data object containing values for replacement.
 * @returns {string} - The processed string with placeholders replaced.
 */
function replacePlaceholders(template, data) {
  if (!template) return "";
  return template.replace(/{([^}]+)}/g, (match, key) => {
    // Exact mapping based on Admin UI template keys
    const mapping = {
      'Company Name': data.name,
      'Domain': data.domain || data.url,
      'Email': data.email,
      'User Name': data.userName,
      'Phone No': data.phoneNo,
      'Password': data.password // Plain text password
    };
    return mapping[key] !== undefined ? mapping[key] : match;
  });
}

// List All Companies
async function getAllCompanies(req, res) {
  try {
    const companies = await Company.find({}).sort({ createdAt: -1 });

    // Get chatbot count for each company
    const companiesWithStats = await Promise.all(
      companies.map(async (company) => {
        const chatbotCount = await Chatbot.countDocuments({ company: company._id });
        const userCount = await User.countDocuments({ company: company._id, isActive: true });

        return {
          ...company.toJSON(),
          stats: {
            chatbots: chatbotCount,
            users: userCount,
          },
        };
      })
    );

    res.json({
      success: true,
      data: companiesWithStats,
    });
  } catch (error) {
    logger.error('Get all companies error:', error);
    res.status(500).json({ error: 'Failed to get companies' });
  }
}

// Get All Companies with Chatbots (for admin dashboard)
async function getAllCompaniesWithChatbots(req, res) {
  try {
    const companies = await Company.find({}).sort({ createdAt: -1 });

    const companiesWithChatbots = await Promise.all(
      companies.map(async (company) => {
        const chatbots = await Chatbot.find({ company: company._id })
          .select('name isActive settings.llmProvider createdAt');

        // Get total messages and unique users for each chatbot
        const chatbotsWithStats = await Promise.all(
          chatbots.map(async (chatbot) => {
            const totalMessages = await Message.countDocuments({ chatbotId: chatbot._id });
            const uniqueUsers = await UserSession.distinct('sessionId', {
              chatbotId: chatbot._id,
              $or: [{ phone: { $exists: true, $ne: null } }, { email: { $exists: true, $ne: null } }],
            });

            return {
              ...chatbot.toJSON(),
              status: chatbot.isActive ? 'active' : 'inactive', // Map isActive to status for frontend
              total_messages: totalMessages,
              unique_users: uniqueUsers.length,
            };
          })
        );

        return {
          ...company.toJSON(),
          chatbots: chatbotsWithStats,
        };
      })
    );

    res.json({
      success: true,
      data: companiesWithChatbots,
    });
  } catch (error) {
    logger.error('Get companies with chatbots error:', error);
    res.status(500).json({ error: 'Failed to get companies' });
  }
}

// Get Single Company
async function getCompany(req, res) {
  try {
    const { id } = req.params;
    const company = await Company.findById(id);

    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    res.json({
      success: true,
      data: company,
    });
  } catch (error) {
    logger.error('Get company error:', error);
    res.status(500).json({ error: 'Failed to get company' });
  }
}

// Create Company
async function createCompany(req, res) {
  const {
    name, domain, url, settings, email, userName, phoneNo, managed_by_name, password,
    emailSubject, emailBody
  } = req.body;

  try {

    console.log('🔍 [Company Creation] Received data:', {
      name, domain, url, email, userName, phoneNo, managed_by_name,
      hasPassword: !!password
    });

    // Validate required fields
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Company name is required' });
    }
    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'Email is required' });
    }
    if (!userName || !userName.trim()) {
      return res.status(400).json({ error: 'User name is required' });
    }
    if (!phoneNo || !phoneNo.trim()) {
      return res.status(400).json({ error: 'Phone number is required' });
    }
    if (!managed_by_name || !managed_by_name.trim()) {
      return res.status(400).json({ error: 'Managed by name is required' });
    }
    if (!password || !password.trim()) {
      return res.status(400).json({ error: 'Password is required' });
    }

    // ✅ Check if user with this email already exists BEFORE creating company
    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      logger.warn(`❌ [Company Creation] User with email ${normalizedEmail} already exists`);
      return res.status(400).json({
        error: 'A user with this email already exists. Please use a different email address.'
      });
    }

    // Use url as domain (frontend sends processed domain in 'url' field)
    let finalDomain = url;

    // Generate API key
    const apiKey = `trok_${crypto.randomBytes(16).toString('hex')}`;

    // Hash password if provided
    let hashedPassword = password;
    if (password) {
      const saltRounds = 10;
      hashedPassword = await bcrypt.hash(password, saltRounds);
    }

    const companyData = {
      name: name.trim(),
      domain: finalDomain,
      apiKey,
      userName: userName?.trim(),
      email: email?.toLowerCase().trim(),
      phoneNo: phoneNo?.trim(),
      managed_by_name: managed_by_name?.trim(),
      password: hashedPassword,
      settings: settings || {},
    };

    console.log('🏗️ [Company Creation] Creating company with data:', companyData);

    const company = new Company(companyData);

    try {
      await company.save();
      console.log('✅ [Company Creation] Company saved successfully:', company._id);
    } catch (validationError) {
      console.error('❌ [Company Creation] Validation error:', validationError.message);
      console.error('❌ [Company Creation] Validation details:', validationError.errors);
      throw validationError;
    }

    // If user credentials provided, create user for this company
    // Note: Email uniqueness already checked above, so this should always succeed
    if (email && userName && password) {
      try {
        const user = new User({
          name: userName,
          email: normalizedEmail, // Use already normalized email
          password: password, // Will be hashed by pre-save hook
          company: company._id,
          phone: phoneNo,
          role: 'owner',
          isActive: true,
          permissions: {
            manageChatbots: true,
            viewAnalytics: true,
            manageUsers: true,
          },
        });
        await user.save();
        logger.info(`✅ [Company Creation] User created for company ${company._id}`);
      } catch (userError) {
        logger.error('❌ [Company Creation] Error creating user for company:', userError);
        // If user creation fails (e.g., duplicate email somehow), rollback company creation
        if (userError.code === 11000 || userError.message.includes('duplicate') || userError.message.includes('unique')) {
          await Company.findByIdAndDelete(company._id);
          logger.warn(`🔄 [Company Creation] Rolled back company creation due to duplicate user email`);
          return res.status(400).json({
            error: 'A user with this email already exists. Please use a different email address.'
          });
        }
        // For other errors, log but don't fail company creation (user can be created later)
        logger.warn(`⚠️ [Company Creation] User creation failed but company was created. User can be created manually later.`);
      }
    }

    res.status(201).json({
      success: true,
      data: company,
      message: 'Company created successfully',
    });
  } catch (error) {
    logger.error('Create company error:', error);
    logger.error('Error details:', {
      message: error.message,
      code: error.code,
      name: error.name,
      stack: error.stack
    });

    if (error.code === 11000) {
      return res.status(400).json({ error: 'Company with this domain or API key already exists' });
    }

    // Handle validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        error: 'Validation failed',
        details: messages
      });
    }

    res.status(500).json({ error: 'Failed to create company' });
  }

  // --- Send Welcome Email (Non-blocking) ---
  if (email && emailSubject && emailBody) {
    try {
      const emailData = {
        name,
        domain: url || domain,
        url,
        email: email.toLowerCase().trim(),
        userName,
        phoneNo,
        password // Plain text password for the email
      };

      const finalSubject = replacePlaceholders(emailSubject, emailData);
      const finalBody = replacePlaceholders(emailBody, emailData);

      console.log(`📧 [Welcome Email] Preparing email for ${emailData.email}`);

      const success = await emailService.sendCustomEmail({
        to: emailData.email,
        subject: finalSubject,
        html: finalBody
      });

      if (success) {
        logger.info(`✅ [Welcome Email] Sent successfully to ${emailData.email}`);
      } else {
        logger.warn(`⚠️ [Welcome Email] Failed to send to ${emailData.email}`);
      }
    } catch (emailError) {
      logger.error('❌ [Welcome Email] Error in automation logic:', emailError);
    }
  }
}

// Update Company
async function updateCompany(req, res) {
  try {
    const { id } = req.params;
    const updates = req.body;

    console.log('🔍 [Company Update] Received request for company:', id);
    console.log('🔍 [Company Update] Update data:', updates);
    console.log('🔍 [Company Update] Request user:', req.user ? req.user.id : 'No user');

    // Don't allow API key updates through this endpoint
    delete updates.apiKey;

    // Handle 'url' as 'domain' for frontend compatibility
    if (updates.url && !updates.domain) {
      updates.domain = updates.url;
    }

    // Hash password if it's being updated
    if (updates.password) {
      console.log('🔐 [Company Update] Hashing password for company:', id);
      const saltRounds = 10;
      updates.password = await bcrypt.hash(updates.password, saltRounds);
      console.log('✅ [Company Update] Password hashed successfully');
    }

    console.log('💾 [Company Update] Final updates to apply:', updates);

    const company = await Company.findByIdAndUpdate(id, updates, { new: true, runValidators: true });

    if (!company) {
      console.log('❌ [Company Update] Company not found:', id);
      return res.status(404).json({ error: 'Company not found' });
    }

    // ✅ Synchronize domain update with associated chatbots
    if (company.domain) {
      try {
        console.log('🤖 [Company Update] Synchronizing domain with chatbots for company:', company._id);

        // Find all chatbots for this company
        const chatbots = await Chatbot.find({ company: company._id });

        if (chatbots.length > 0) {
          const updatePromises = chatbots.map(bot => {
            // Update websiteUrl and add to allowedDomains if missing
            const allowedDomains = bot.settings?.allowedDomains || [];
            const domainValue = company.domain.replace(/^https?:\/\//, '').split('/')[0];

            if (!allowedDomains.includes(domainValue)) {
              allowedDomains.push(domainValue);
            }

            return Chatbot.updateOne(
              { _id: bot._id },
              {
                $set: {
                  websiteUrl: company.domain,
                  'settings.allowedDomains': allowedDomains
                }
              }
            );
          });

          await Promise.all(updatePromises);
          console.log(`✅ [Company Update] Synchronized ${chatbots.length} chatbots with new domain: ${company.domain}`);
        }
      } catch (syncError) {
        console.error('❌ [Company Update] Error synchronizing chatbots:', syncError);
        // Don't fail the company update if sync fails
      }
    }

    console.log('✅ [Company Update] Company updated successfully:', company._id);
    console.log('📋 [Company Update] Updated fields:', {
      userName: company.userName,
      email: company.email,
      phoneNo: company.phoneNo,
      managed_by_name: company.managed_by_name,
      hasPassword: !!company.password
    });

    // If email or password was updated, also update the corresponding User record
    if (updates.email || updates.password) {
      try {
        console.log('👤 [Company Update] Updating corresponding User record for company:', company._id);

        // First, check if the user exists
        const existingUser = await User.findOne({ company: company._id, role: 'owner' });
        console.log('👤 [Company Update] Existing user found:', existingUser ? { id: existingUser._id, email: existingUser.email } : 'No user found');

        if (existingUser) {
          // Use updateOne to avoid triggering pre-save hooks that would double-hash the password
          const userUpdateData = {};
          if (updates.email) {
            userUpdateData.email = updates.email.toLowerCase().trim();
          }
          if (updates.password) {
            // Password is already hashed above in updates.password
            userUpdateData.password = updates.password;
          }

          const updateResult = await User.updateOne(
            { _id: existingUser._id },
            { $set: userUpdateData }
          );

          console.log('✅ [Company Update] User record updated successfully:', existingUser._id, 'modified:', updateResult.modifiedCount);
        } else {
          console.log('⚠️ [Company Update] No owner user found for company:', company._id);
          // Try to find any user for this company
          const anyUser = await User.findOne({ company: company._id });
          console.log('👤 [Company Update] Any user found for company:', anyUser ? { id: anyUser._id, email: anyUser.email, role: anyUser.role } : 'No users at all');

          // If no user exists for this company, create one using the company credentials
          if (!anyUser && company.userName && company.email && company.password) {
            try {
              console.log('🏗️ [Company Update] Creating missing User record for company:', company._id);

              const newUser = new User({
                name: company.userName,
                email: updates.email ? updates.email.toLowerCase().trim() : company.email.toLowerCase(),
                password: updates.password ? hashedPassword : company.password, // Already hashed
                company: company._id,
                phone: company.phoneNo,
                role: 'owner',
                isActive: true,
                permissions: {
                  manageChatbots: true,
                  viewAnalytics: true,
                  manageUsers: true,
                },
              });

              await newUser.save();
              console.log('✅ [Company Update] Created new User record:', newUser._id, 'with email:', newUser.email);
            } catch (createUserError) {
              console.error('❌ [Company Update] Failed to create User record:', createUserError);
            }
          } else if (!company.userName || !company.email || !company.password) {
            console.log('⚠️ [Company Update] Cannot create User record - missing company credentials');
          }
        }
      } catch (userUpdateError) {
        console.error('❌ [Company Update] Error updating user record:', userUpdateError);
        // Don't fail the company update if user update fails
      }
    }

    res.json({
      success: true,
      data: company,
    });
  } catch (error) {
    console.error('❌ [Company Update] Error:', error);
    console.error('❌ [Company Update] Error details:', {
      message: error.message,
      code: error.code,
      name: error.name
    });
    res.status(500).json({ error: 'Failed to update company' });
  }
}

// Delete Company
async function deleteCompany(req, res) {
  try {
    const { id } = req.params;

    // Get all chatbots for this company first
    const chatbots = await Chatbot.find({ company: id }).select('_id name');
    const chatbotIds = chatbots.map(cb => cb._id);

    console.log(`🔍 [Company Delete] Checking company ${id}`);
    console.log(`🔍 [Company Delete] Found ${chatbots.length} chatbots to delete`);
    console.log(`🔍 [Company Delete] Chatbot IDs:`, chatbotIds);

    // CASCADE DELETION: Delete all related data for all chatbots in this company
    logger.info(`🗑️ [Company Delete] Starting cascade deletion for company ${id} with ${chatbots.length} chatbots`);

    let totalDeleted = {
      embeddings: 0,
      chats: 0,
      messages: 0,
      sessions: 0,
      leads: 0,
      verifiedUsers: 0,
      phoneUsers: 0,
    };

    // For each chatbot, delete its related data
    for (const chatbot of chatbots) {
      logger.info(`🗑️ [Company Delete] Deleting data for chatbot: ${chatbot.name} (${chatbot._id})`);

      // 1. Delete all embeddings for this chatbot
      const embeddingDelete = await Embedding.deleteMany({ chatbotId: chatbot._id });
      totalDeleted.embeddings += embeddingDelete.deletedCount;

      // 2. Delete all chats for this chatbot
      const chatDelete = await Chat.deleteMany({ chatbotId: chatbot._id });
      totalDeleted.chats += chatDelete.deletedCount;

      // 3. Delete all messages for this chatbot
      const messageDelete = await Message.deleteMany({ chatbotId: chatbot._id });
      totalDeleted.messages += messageDelete.deletedCount;

      // 4. Delete all user sessions for this chatbot
      const sessionDelete = await UserSession.deleteMany({ chatbotId: chatbot._id });
      totalDeleted.sessions += sessionDelete.deletedCount;

      // 5. Delete all lead captures for this chatbot
      const leadDelete = await LeadCapture.deleteMany({ chatbotId: chatbot._id });
      totalDeleted.leads += leadDelete.deletedCount;

      // 6. Delete all verified users for this chatbot
      const verifiedUserDelete = await VerifiedUser.deleteMany({ chatbot_id: chatbot._id });
      totalDeleted.verifiedUsers += verifiedUserDelete.deletedCount;

      // 7. Delete all phone users for this chatbot
      const phoneUserDelete = await PhoneUser.deleteMany({ chatbotId: chatbot._id });
      totalDeleted.phoneUsers += phoneUserDelete.deletedCount;

      logger.info(`🗑️ [Company Delete] Deleted data for chatbot ${chatbot.name}:`, {
        embeddings: embeddingDelete.deletedCount,
        chats: chatDelete.deletedCount,
        messages: messageDelete.deletedCount,
        sessions: sessionDelete.deletedCount,
        leads: leadDelete.deletedCount,
        verifiedUsers: verifiedUserDelete.deletedCount,
        phoneUsers: phoneUserDelete.deletedCount,
      });
    }

    // Delete all chatbots for this company
    const chatbotDelete = await Chatbot.deleteMany({ company: id });
    logger.info(`🗑️ [Company Delete] Deleted ${chatbotDelete.deletedCount} chatbots`);

    // Delete all users for this company
    const userDelete = await User.deleteMany({ company: id });
    logger.info(`🗑️ [Company Delete] Deleted ${userDelete.deletedCount} users`);

    // Delete all credit transactions for this company
    const creditDelete = await UserCreditTransaction.deleteMany({ company: id });
    logger.info(`🗑️ [Company Delete] Deleted ${creditDelete.deletedCount} credit transactions`);

    // Finally, delete the company itself
    await Company.findByIdAndDelete(id);
    logger.info(`🗑️ [Company Delete] Successfully deleted company ${id}`);

    res.json({
      success: true,
      message: 'Company and all related data deleted successfully',
      deletedData: {
        ...totalDeleted,
        chatbots: chatbotDelete.deletedCount,
        users: userDelete.deletedCount,
        creditTransactions: creditDelete.deletedCount,
      }
    });
  } catch (error) {
    logger.error('Delete company error:', error);
    res.status(500).json({ error: 'Failed to delete company' });
  }
}

// Get Company Credits Balance
async function getCompanyCredits(req, res) {
  try {
    const { id } = req.params;
    const company = await Company.findById(id).select('credits');

    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // Initialize credits if not exists
    if (!company.credits) {
      company.credits = {
        total: 0,
        used: 0,
        remaining: 0,
        history: [],
      };
      company.markModified('credits');
      await company.save();
    }

    res.json({
      success: true,
      data: {
        total_credits: company.credits.total || 0,
        used_credits: company.credits.used || 0,
        remaining_credits: (company.credits.total || 0) - (company.credits.used || 0),
        expiresAt: company.credits.expiresAt, // Include expiration date
      },
    });
  } catch (error) {
    logger.error('Get company credits error:', error);
    res.status(500).json({ error: 'Failed to get credits' });
  }
}

// Add Company Credits
async function addCompanyCredits(req, res) {
  try {
    console.log('🔥 [Backend] addCompanyCredits CALLED with body:', JSON.stringify(req.body));

    const { id } = req.params;
    const { credits, duration, reason } = req.body;

    console.log('🚨 Extracted id:', id);
    console.log('🚨 Extracted credits:', credits);
    console.log('🚨 Extracted duration:', duration);
    console.log('🚨 Duration type:', typeof duration);

    console.log('💰 [Backend] Parsed - id:', id, 'credits:', credits, 'duration:', duration);
    console.log('💰 [Backend] duration type:', typeof duration, 'parsed:', parseInt(duration));

    // Must have either credits or duration
    const creditsNum = parseInt(credits) || 0;
    const durationNum = parseInt(duration) || 0;

    if (creditsNum <= 0 && durationNum <= 0) {
      return res.status(400).json({ error: 'Either credits or duration must be provided' });
    }

    // Validate credits if provided
    if (credits !== undefined && credits !== null && credits !== '' && (isNaN(creditsNum) || creditsNum < 0)) {
      return res.status(400).json({ error: 'Credits must be a valid non-negative number' });
    }

    console.log('🔍 [Backend] Validation:', {
      credits: creditsNum,
      duration: durationNum,
      hasCredits: creditsNum > 0,
      hasDuration: durationNum > 0
    });

    const company = await Company.findById(id);

    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // Initialize credits if not exists
    if (!company.credits) {
      company.credits = {
        total: 0,
        used: 0,
        remaining: 0,
        history: [],
      };
    }

    // Add credits if provided
    const oldTotal = company.credits.total || 0;
    if (creditsNum > 0) {
      company.credits.total = oldTotal + creditsNum;
      company.credits.remaining = company.credits.total - (company.credits.used || 0);
    }

    // Calculate expiration date based on duration
    console.log('📅 [Backend] About to check duration:', duration, 'parsed:', parseInt(duration), 'condition:', duration && parseInt(duration) > 0);

    // Handle duration logic
    if (duration !== undefined && duration !== null && duration !== '' && duration !== 0 && duration !== '0') {
      const durationNum = parseInt(duration);
      console.log('📅 [Backend] Duration provided:', duration, 'parsed to:', durationNum);
      if (!isNaN(durationNum) && durationNum > 0) {
        console.log('📅 [Backend] Duration is valid, calculating expiration...');
        const expirationDate = new Date();
        expirationDate.setDate(expirationDate.getDate() + durationNum);
        company.credits.expiresAt = expirationDate;
        console.log(`📅 [Backend] Set expiration date: ${expirationDate.toISOString()}`);
      } else if (durationNum === 0) {
        // Duration explicitly set to 0 - clear the expiration date (unlimited)
        console.log('📅 [Backend] Duration explicitly set to 0, clearing expiration date');
        company.credits.expiresAt = null;
      }
    } else {
      // No duration provided or empty - keep existing expiration
      console.log('📅 [Backend] No duration provided or empty, keeping existing expiration');
    }

    // Add to history
    if (!company.credits.history) {
      company.credits.history = [];
    }
    company.credits.history.push({
      type: 'add',
      amount: creditsNum,
      duration: durationNum,
      expiresAt: company.credits.expiresAt,
      reason: reason,
      addedBy: req.user?.id || 'system',
      timestamp: new Date(),
    });

    // Mark nested object as modified for Mongoose to save it
    company.markModified('credits');
    await company.save();

    // Create credit transaction logs for all users in this company
    try {
      const users = await User.find({ company: company._id });

      if (users.length > 0) {
        const adminInfo = req.user ? {
          id: req.user.id,
          name: req.user.name || req.user.email
        } : null;

        // Create transaction entries for each user
        const transactionPromises = users.map(async (user) => {
          // Calculate balance after for this user
          const userTransactions = await UserCreditTransaction.find({ user: user._id }).sort({ created_at: -1 }).limit(1);
          const lastBalance = userTransactions.length > 0 ? userTransactions[0].balance_after : 0;

          return UserCreditTransaction.create({
            user: user._id,
            company: company._id,
            type: 'admin_add',
            amount: creditsNum,
            balance_after: lastBalance + creditsNum,
            reason: reason || 'Credits added by admin',
            admin: adminInfo
          });
        });

        await Promise.all(transactionPromises);
        logger.info(`Created ${users.length} credit transaction logs for company ${id} (addition)`);
      }
    } catch (transactionError) {
      logger.error('Error creating user credit transactions for addition:', transactionError);
      // Don't fail the main operation if transaction logging fails
    }

    logger.info(`Credits/duration operation for company ${id}: credits added: ${creditsNum}, duration extended: ${durationNum}, old total: ${oldTotal}, new total: ${company.credits.total}`);

    const message = creditsNum > 0 && durationNum > 0
      ? `${creditsNum} credits added and duration extended by ${durationNum} days`
      : creditsNum > 0
        ? `${creditsNum} credits added successfully`
        : durationNum > 0
          ? `Duration extended by ${durationNum} days`
          : 'Operation completed';

    res.json({
      success: true,
      data: {
        total_credits: company.credits.total,
        used_credits: company.credits.used || 0,
        remaining_credits: company.credits.remaining,
        expiresAt: company.credits.expiresAt, // Include expiration date
      },
      message: message,
    });
  } catch (error) {
    logger.error('Add company credits error:', error);
    res.status(500).json({ error: 'Failed to add credits' });
  }
}

// Remove Company Credits
async function removeCompanyCredits(req, res) {
  try {
    const { id } = req.params;
    const { credits, duration } = req.body;

    // Must have either credits or duration
    const creditsNum = parseInt(credits) || 0;
    const durationNum = parseInt(duration) || 0;

    if (creditsNum <= 0 && durationNum <= 0) {
      return res.status(400).json({ error: 'Either credits or duration must be provided' });
    }

    // Validate credits if provided
    if (credits !== undefined && credits !== null && credits !== '' && (isNaN(creditsNum) || creditsNum < 0)) {
      return res.status(400).json({ error: 'Credits must be a valid non-negative number' });
    }

    const company = await Company.findById(id);

    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // Initialize credits if not exists
    if (!company.credits) {
      company.credits = {
        total: 0,
        used: 0,
        remaining: 0,
        history: [],
      };
    }

    // Remove credits if provided
    if (creditsNum > 0) {
      const currentRemaining = (company.credits.total || 0) - (company.credits.used || 0);

      if (creditsNum > currentRemaining) {
        return res.status(400).json({ error: 'Insufficient credits to remove' });
      }

      // Remove credits
      const oldTotal = company.credits.total || 0;
      company.credits.total = Math.max(0, oldTotal - creditsNum);
      company.credits.remaining = company.credits.total - (company.credits.used || 0);
    }

    // Reduce expiration if duration is provided (for credit removal)
    if (duration && duration > 0 && company.credits.expiresAt) {
      const currentExpiry = new Date(company.credits.expiresAt);
      currentExpiry.setDate(currentExpiry.getDate() - parseInt(duration));
      company.credits.expiresAt = currentExpiry;
      console.log(`⏰ [Credit Removal] Reduced expiration by ${duration} days. New expiry: ${currentExpiry.toISOString()}`);
    }

    // Add to history
    if (!company.credits.history) {
      company.credits.history = [];
    }
    company.credits.history.push({
      type: 'remove',
      amount: creditsNum,
      duration: durationNum,
      expiresAt: company.credits.expiresAt,
      removedBy: req.user?.id || 'system',
      timestamp: new Date(),
    });

    // Mark nested object as modified for Mongoose to save it
    company.markModified('credits');
    await company.save();

    // Create credit transaction logs for all users in this company
    try {
      const users = await User.find({ company: company._id });

      if (users.length > 0) {
        const adminInfo = req.user ? {
          id: req.user.id,
          name: req.user.name || req.user.email
        } : null;

        // Create transaction entries for each user
        const transactionPromises = users.map(async (user) => {
          // Calculate balance after for this user
          const userTransactions = await UserCreditTransaction.find({ user: user._id }).sort({ created_at: -1 }).limit(1);
          const lastBalance = userTransactions.length > 0 ? userTransactions[0].balance_after : 0;

          return UserCreditTransaction.create({
            user: user._id,
            company: company._id,
            type: 'admin_remove',
            amount: -creditsNum, // Negative amount for removal
            balance_after: Math.max(0, lastBalance - creditsNum),
            reason: reason || 'Credits removed by admin',
            admin: adminInfo
          });
        });

        await Promise.all(transactionPromises);
        logger.info(`Created ${users.length} credit transaction logs for company ${id} (removal)`);
      }
    } catch (transactionError) {
      logger.error('Error creating user credit transactions for removal:', transactionError);
      // Don't fail the main operation if transaction logging fails
    }

    const message = creditsNum > 0 && durationNum > 0
      ? `${creditsNum} credits removed and duration reduced by ${durationNum} days`
      : creditsNum > 0
        ? `${creditsNum} credits removed successfully`
        : durationNum > 0
          ? `Duration reduced by ${durationNum} days`
          : 'Operation completed';

    logger.info(`Credits/duration operation for company ${id}: credits removed: ${creditsNum}, duration reduced: ${durationNum}`);

    res.json({
      success: true,
      data: {
        total_credits: company.credits.total,
        used_credits: company.credits.used || 0,
        remaining_credits: company.credits.remaining,
        expiresAt: company.credits.expiresAt, // Include expiration date
      },
      message: message,
    });
  } catch (error) {
    logger.error('Remove company credits error:', error);
    res.status(500).json({ error: 'Failed to remove credits' });
  }
}

// Get Company Credit History
async function getCompanyCreditHistory(req, res) {
  try {
    const { id } = req.params;
    const company = await Company.findById(id).select('credits');

    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    const history = company.credits?.history || [];

    res.json({
      success: true,
      data: {
        history: history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)),
      },
    });
  } catch (error) {
    logger.error('Get credit history error:', error);
    res.status(500).json({ error: 'Failed to get credit history' });
  }
}

// Assign/Set Company Credits (used for setting absolute value)
async function assignCompanyCredits(req, res) {
  try {

    const { id } = req.params;
    const { credits, reason } = req.body;

    if (credits === undefined || credits < 0) {
      return res.status(400).json({ error: 'Valid credits amount is required' });
    }

    const company = await Company.findById(id);

    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // Initialize credits if not exists
    if (!company.credits) {
      company.credits = {
        total: 0,
        used: 0,
        remaining: 0,
        history: [],
      };
    }

    // Set credits (absolute value)
    company.credits.total = credits;
    company.credits.used = 0; // Reset used when assigning
    company.credits.remaining = credits;

    // Add to history
    if (!company.credits.history) {
      company.credits.history = [];
    }
    company.credits.history.push({
      type: 'assign',
      amount: credits,
      reason: reason || 'Credits assigned by admin',
      assignedBy: req.user?.id || 'system',
      timestamp: new Date(),
    });

    // Mark nested object as modified for Mongoose to save it
    company.markModified('credits');
    await company.save();

    // Create credit transaction logs for all users in this company
    try {
      const users = await User.find({ company: company._id });

      if (users.length > 0) {
        const adminInfo = req.user ? {
          id: req.user.id,
          name: req.user.name || req.user.email
        } : null;

        // Create transaction entries for each user (absolute assignment)
        const transactionPromises = users.map(async (user) => {
          return UserCreditTransaction.create({
            user: user._id,
            company: company._id,
            type: 'reset',
            amount: credits,
            balance_after: credits,
            reason: reason || 'Credits assigned by admin',
            admin: adminInfo
          });
        });

        await Promise.all(transactionPromises);
        logger.info(`Created ${users.length} credit transaction logs for company ${id} (assignment)`);
      }
    } catch (transactionError) {
      logger.error('Error creating user credit transactions for assignment:', transactionError);
      // Don't fail the main operation if transaction logging fails
    }

    logger.info(`Credits assigned for company ${id}: ${credits}`);

    res.json({
      success: true,
      data: {
        total_credits: company.credits.total,
        used_credits: 0,
        remaining_credits: credits,
      },
      message: `Credits set to ${credits} successfully`,
    });
  } catch (error) {
    logger.error('Assign company credits error:', error);
    res.status(500).json({ error: 'Failed to assign credits' });
  }
}

// Get Company Password (if decryptable)
async function getCompanyPassword(req, res) {
  try {
    const { id } = req.params;
    const company = await Company.findById(id).select('password');
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    const password = company.password;
    // Check if it looks like a bcrypt hash (starts with $2a$ or $2b$)
    const isHashed = password && (password.startsWith('$2a$') || password.startsWith('$2b$'));

    if (isHashed) {
      return res.json({
        success: true,
        data: {
          canDecrypt: false,
          message: 'Password is hashed and cannot be decrypted'
        }
      });
    }

    res.json({
      success: true,
      data: {
        canDecrypt: true,
        password: password
      }
    });
  } catch (error) {
    logger.error('Get company password error:', error);
    res.status(500).json({ error: 'Failed to get password' });
  }
}

module.exports = {
  getAllCompanies,
  getAllCompaniesWithChatbots,
  getCompany,
  createCompany,
  updateCompany,
  deleteCompany,
  getCompanyCredits,
  addCompanyCredits,
  removeCompanyCredits,
  getCompanyCreditHistory,
  assignCompanyCredits,
  getCompanyPassword,
};

