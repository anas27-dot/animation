const Admin = require('../models/Admin');
const Company = require('../models/Company');
const Chatbot = require('../models/Chatbot');
const User = require('../models/User');
const UserSession = require('../models/UserSession');
const Message = require('../models/Message');
const LeadCapture = require('../models/LeadCapture');
const logger = require('../config/logging');
const { generateToken } = require('../middleware/jwtAuthMiddleware');

// Admin Login
async function login(req, res) {
  try {
    const { email, password } = req.body;

    logger.info('Admin login attempt', { email, hasPassword: !!password });

    if (!email || !password) {
      logger.warn('Admin login failed: missing credentials', { email: !!email, password: !!password });
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const admin = await Admin.findOne({ email: email.toLowerCase(), isActive: true });
    
    if (!admin) {
      logger.warn('Admin login failed: admin not found', { email: email.toLowerCase() });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    logger.info('Admin found', { adminId: admin._id, email: admin.email, isActive: admin.isActive });

    const isValidPassword = await admin.comparePassword(password);
    if (!isValidPassword) {
      logger.warn('Admin login failed: invalid password', { email: email.toLowerCase(), adminId: admin._id });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    logger.info('Admin login successful', { adminId: admin._id, email: admin.email });

    // Update last login
    admin.lastLogin = new Date();
    await admin.save();

    // Generate JWT token
    const token = generateToken({
      id: admin._id,
      email: admin.email,
      role: admin.role,
      type: 'admin',
    });

    res.json({
      success: true,
      data: {
        token,
        role: 'admin', // Role for routing
        user: { // User object for AuthContext
          id: admin._id,
          name: admin.name,
          email: admin.email,
          role: admin.role, // admin or super_admin
          permissions: admin.permissions,
        },
        admin: { // Keep admin for backward compatibility
          id: admin._id,
          name: admin.name,
          email: admin.email,
          role: admin.role,
          permissions: admin.permissions,
        },
      },
    });
  } catch (error) {
    logger.error('Admin login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
}

// Get Admin Stats
async function getStats(req, res) {
  try {
    const [
      totalCompanies,
      activeCompanies,
      totalChatbots,
      activeChatbots,
      totalUsers,
      totalSessions,
      totalMessages,
      totalLeads,
    ] = await Promise.all([
      Company.countDocuments(),
      Company.countDocuments({ isActive: true }),
      Chatbot.countDocuments(),
      Chatbot.countDocuments({ isActive: true }),
      User.countDocuments({ isActive: true }),
      UserSession.countDocuments(),
      Message.countDocuments(),
      LeadCapture.countDocuments(),
    ]);

    // Get recent activity (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [recentSessions, recentMessages, recentLeads] = await Promise.all([
      UserSession.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
      Message.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
      LeadCapture.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
    ]);

    res.json({
      success: true,
      data: {
        companies: {
          total: totalCompanies,
          active: activeCompanies,
        },
        chatbots: {
          total: totalChatbots,
          active: activeChatbots,
        },
        users: {
          total: totalUsers,
        },
        sessions: {
          total: totalSessions,
          last7Days: recentSessions,
        },
        messages: {
          total: totalMessages,
          last7Days: recentMessages,
        },
        leads: {
          total: totalLeads,
          last7Days: recentLeads,
        },
      },
    });
  } catch (error) {
    logger.error('Get admin stats error:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
}

// List All Admins
async function getAllAdmins(req, res) {
  try {
    const admins = await Admin.find({}).select('-password').sort({ createdAt: -1 });
    
    res.json({
      success: true,
      data: admins,
    });
  } catch (error) {
    logger.error('Get all admins error:', error);
    res.status(500).json({ error: 'Failed to get admins' });
  }
}

// Create Admin
async function createAdmin(req, res) {
  try {
    const { name, email, password, role, permissions } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    const existingAdmin = await Admin.findOne({ email: email.toLowerCase() });
    if (existingAdmin) {
      return res.status(400).json({ error: 'Admin with this email already exists' });
    }

    const admin = new Admin({
      name,
      email: email.toLowerCase(),
      password,
      role: role || 'admin',
      permissions: permissions || {},
    });

    await admin.save();

    res.status(201).json({
      success: true,
      data: admin.toJSON(),
    });
  } catch (error) {
    logger.error('Create admin error:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: 'Validation error', details: error.message });
    }
    res.status(500).json({ error: 'Failed to create admin' });
  }
}

// Update Admin
async function updateAdmin(req, res) {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Don't allow password updates through this endpoint
    delete updates.password;

    const admin = await Admin.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
    
    if (!admin) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    res.json({
      success: true,
      data: admin.toJSON(),
    });
  } catch (error) {
    logger.error('Update admin error:', error);
    res.status(500).json({ error: 'Failed to update admin' });
  }
}

// Delete Admin
async function deleteAdmin(req, res) {
  try {
    const { id } = req.params;

    // Don't allow deleting super admin
    const admin = await Admin.findById(id);
    if (admin && admin.role === 'super_admin') {
      return res.status(403).json({ error: 'Cannot delete super admin' });
    }

    await Admin.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Admin deleted successfully',
    });
  } catch (error) {
    logger.error('Delete admin error:', error);
    res.status(500).json({ error: 'Failed to delete admin' });
  }
}

// Toggle Admin Role
async function toggleAdminRole(req, res) {
  try {
    const { id } = req.params;

    const admin = await Admin.findById(id);
    if (!admin) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    // Don't allow changing super_admin role
    if (admin.role === 'super_admin') {
      return res.status(403).json({ error: 'Cannot change super admin role' });
    }

    admin.role = admin.role === 'admin' ? 'super_admin' : 'admin';
    await admin.save();

    res.json({
      success: true,
      data: admin.toJSON(),
    });
  } catch (error) {
    logger.error('Toggle admin role error:', error);
    res.status(500).json({ error: 'Failed to toggle admin role' });
  }
}

// Get Admin Trends
async function getTrends(req, res) {
  try {
    const { days = 30 } = req.query;
    const daysNumber = parseInt(days) || 30;
    const startDate = new Date(Date.now() - daysNumber * 24 * 60 * 60 * 1000);

    const trends = [];
    
    // Generate daily trends
    for (let i = daysNumber - 1; i >= 0; i--) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      date.setHours(0, 0, 0, 0);
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const [sessions, messages, leads, companies] = await Promise.all([
        UserSession.countDocuments({ createdAt: { $gte: date, $lt: nextDate } }),
        Message.countDocuments({ createdAt: { $gte: date, $lt: nextDate } }),
        LeadCapture.countDocuments({ createdAt: { $gte: date, $lt: nextDate } }),
        Company.countDocuments({ createdAt: { $gte: date, $lt: nextDate } }),
      ]);

      trends.push({
        date: date.toISOString().split('T')[0],
        sessions,
        messages,
        leads,
        companies,
      });
    }

    res.json({
      success: true,
      data: { trends },
    });
  } catch (error) {
    logger.error('Get trends error:', error);
    res.status(500).json({ error: 'Failed to get trends' });
  }
}

// Get Daily Email Template (placeholder)
async function getDailyEmailTemplate(req, res) {
  try {
    res.json({
      success: true,
      data: {
        subject: 'Daily Chat Summary',
        body: 'This is the daily email template.',
        enabled: false,
      },
    });
  } catch (error) {
    logger.error('Get daily email template error:', error);
    res.status(500).json({ error: 'Failed to get daily email template' });
  }
}

// Update Daily Email Template (placeholder)
async function updateDailyEmailTemplate(req, res) {
  try {
    const { subject, body, enabled } = req.body;
    
    // In a real implementation, you'd save this to a database
    res.json({
      success: true,
      data: {
        subject: subject || 'Daily Chat Summary',
        body: body || 'This is the daily email template.',
        enabled: enabled || false,
      },
    });
  } catch (error) {
    logger.error('Update daily email template error:', error);
    res.status(500).json({ error: 'Failed to update daily email template' });
  }
}

// Send Daily Email (placeholder)
async function sendDailyEmail(req, res) {
  try {
    const { email, date } = req.body;
    
    // In a real implementation, you'd send the email here
    res.json({
      success: true,
      message: 'Daily email sent successfully',
    });
  } catch (error) {
    logger.error('Send daily email error:', error);
    res.status(500).json({ error: 'Failed to send daily email' });
  }
}

// Get Daily Email Logs (placeholder)
async function getDailyEmailLogs(req, res) {
  try {
    const { limit = 50 } = req.query;
    
    // In a real implementation, you'd fetch from a database
    res.json({
      success: true,
      data: {
        logs: [],
        total: 0,
      },
    });
  } catch (error) {
    logger.error('Get daily email logs error:', error);
    res.status(500).json({ error: 'Failed to get daily email logs' });
  }
}

// Temporary User Management for Company Deletion
async function getAllUsers(req, res) {
  try {
    const users = await User.find({})
      .populate('company', 'name')
      .select('name email phone company isActive createdAt')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: { users }
    });
  } catch (error) {
    logger.error('Get all users error:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
}

async function deleteUser(req, res) {
  try {
    const { id } = req.params;

    // Check if user exists
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Delete the user
    await User.findByIdAndDelete(id);

    logger.info('User deleted by admin', {
      userId: id,
      deletedBy: req.user.id
    });

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    logger.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
}

// Manual trigger for daily summary generation (testing)
async function triggerDailySummary(req, res) {
  try {
    const { useToday = true } = req.body; // Default to today for testing
    
    const { generateAllDailySummaries } = require('../services/dailySummaryScheduler');
    
    logger.info(`🧪 [Admin] Manual trigger for daily summary generation (useToday: ${useToday})`);
    
    await generateAllDailySummaries(useToday);
    
    res.json({
      success: true,
      message: `Daily summaries generated successfully for ${useToday ? 'today' : 'yesterday'}`,
    });
  } catch (error) {
    logger.error('Trigger daily summary error:', error);
    res.status(500).json({ error: 'Failed to trigger daily summary generation' });
  }
}

module.exports = {
  login,
  getStats,
  getAllAdmins,
  createAdmin,
  updateAdmin,
  deleteAdmin,
  toggleAdminRole,
  getTrends,
  getDailyEmailTemplate,
  updateDailyEmailTemplate,
  sendDailyEmail,
  getDailyEmailLogs,
  getAllUsers,
  deleteUser,
  triggerDailySummary,
};

