const Offer = require('../models/Offer');
const logger = require('../config/logging');

// Global offer sidebar configuration (stored in memory for simplicity)
// In a production app, this would be stored in a database
let offerSidebarConfig = {
  offer_templates_enabled: false,
  offer_sidebar_display_text: "Offers"
};

// Get offer sidebar configuration
async function getOfferSidebarConfig(req, res) {
  try {
    res.json({
      success: true,
      data: offerSidebarConfig
    });
  } catch (error) {
    logger.error('Get offer sidebar config error:', error);
    res.status(500).json({ error: 'Failed to get offer sidebar config' });
  }
}

// Update offer sidebar configuration
async function updateOfferSidebarConfig(req, res) {
  try {
    const { enabled, display_text } = req.body;

    offerSidebarConfig = {
      offer_templates_enabled: enabled,
      offer_sidebar_display_text: display_text
    };

    res.json({
      success: true,
      data: offerSidebarConfig,
      message: 'Offer sidebar config updated successfully'
    });
  } catch (error) {
    logger.error('Update offer sidebar config error:', error);
    res.status(500).json({ error: 'Failed to update offer sidebar config' });
  }
}

// Get all offer templates
async function getOfferTemplates(req, res) {
  try {
    const templates = await Offer.find({ is_active: true })
      .sort({ order: 1, created_at: -1 });

    res.json({
      success: true,
      data: {
        templates: templates
      }
    });
  } catch (error) {
    logger.error('Get offer templates error:', error);
    res.status(500).json({ error: 'Failed to get offer templates' });
  }
}

// Get single offer template
async function getOfferTemplate(req, res) {
  try {
    const { id } = req.params;
    const template = await Offer.findById(id);

    if (!template) {
      return res.status(404).json({ error: 'Offer template not found' });
    }

    res.json({
      success: true,
      data: template
    });
  } catch (error) {
    logger.error('Get offer template error:', error);
    res.status(500).json({ error: 'Failed to get offer template' });
  }
}

// Create offer template
async function createOfferTemplate(req, res) {
  try {
    const templateData = req.body;
    const template = new Offer(templateData);
    await template.save();

    res.status(201).json({
      success: true,
      data: template,
      message: 'Offer template created successfully'
    });
  } catch (error) {
    logger.error('Create offer template error:', error);
    res.status(500).json({ error: 'Failed to create offer template' });
  }
}

// Update offer template
async function updateOfferTemplate(req, res) {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const template = await Offer.findByIdAndUpdate(
      id,
      { ...updateData, updated_at: new Date() },
      { new: true, runValidators: true }
    );

    if (!template) {
      return res.status(404).json({ error: 'Offer template not found' });
    }

    res.json({
      success: true,
      data: template,
      message: 'Offer template updated successfully'
    });
  } catch (error) {
    logger.error('Update offer template error:', error);
    res.status(500).json({ error: 'Failed to update offer template' });
  }
}

// Delete offer template
async function deleteOfferTemplate(req, res) {
  try {
    const { id } = req.params;
    const template = await Offer.findByIdAndDelete(id);

    if (!template) {
      return res.status(404).json({ error: 'Offer template not found' });
    }

    res.json({
      success: true,
      message: 'Offer template deleted successfully'
    });
  } catch (error) {
    logger.error('Delete offer template error:', error);
    res.status(500).json({ error: 'Failed to delete offer template' });
  }
}

module.exports = {
  getOfferSidebarConfig,
  updateOfferSidebarConfig,
  getOfferTemplates,
  getOfferTemplate,
  createOfferTemplate,
  updateOfferTemplate,
  deleteOfferTemplate,
};
