/**
 * Translation Routes
 * Handles Azure Translator API integration for chat summaries and transcripts
 */

const express = require('express');
const router = express.Router();
const translationController = require('../controllers/translationController');

// ============================================
// TRANSLATION ROUTES
// ============================================

/**
 * GET /api/v1/translate/test
 * Test Azure Translator configuration
 */
router.get('/test', translationController.testTranslation);

/**
 * GET /api/v1/translate/languages
 * Get supported languages from Azure Translator
 */
router.get('/languages', translationController.getLanguages);

/**
 * POST /api/v1/translate/text
 * Translate text using Azure Translator
 * Body: { texts: string[], targetLanguage: string, sourceLanguage?: string }
 */
router.post('/text', translationController.translateText);

/**
 * POST /api/v1/translate/transcript
 * Translate chat transcript using Azure Translator
 * Body: { transcript: Array, targetLanguage: string }
 */
router.post('/transcript', translationController.translateTranscript);

module.exports = router;
