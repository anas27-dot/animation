const express = require('express');
const router = express.Router();
const multer = require('multer');
const mongoose = require('mongoose');
const Chatbot = require('../models/Chatbot');
const Embedding = require('../models/Embedding');
const { authenticateAPIKey } = require('../middleware/authMiddleware');
const { authenticateJWT } = require('../middleware/jwtAuthMiddleware');
const { sensitiveLimiter } = require('../middleware/rateLimiter');
const embeddingService = require('../services/embeddingService');
const { chunkText } = require('../utils/textChunker');
const logger = require('../config/logging');
const { scheduleKbReseed } = require('../services/kbSuggestionExtractor');

// Configure canvas for pdf-parse
let PDFParseClass;
try {
  const Canvas = require('canvas');
  const pdfParseModule = require('pdf-parse');
  PDFParseClass = pdfParseModule.PDFParse;
  // Override canvas methods for pdf.js
  if (!globalThis.DOMMatrix) {
    globalThis.DOMMatrix = Canvas.DOMMatrix;
  }
} catch (err) {
  logger.warn('Canvas not available for PDF parsing:', err.message);
  const pdfParseModule = require('pdf-parse');
  PDFParseClass = pdfParseModule.PDFParse;
}

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  },
});

// Middleware that accepts JWT (admin) or API key
const authenticateFlexible = async (req, res, next) => {
  // Try JWT first (for admin dashboard)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const jwt = require('jsonwebtoken');
      const token = authHeader.substring(7);
      const JWT_SECRET = process.env.JWT_SECRET;
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      if (req.user.type === 'admin') {
        return next();
      }
    } catch (err) {
      // JWT failed, try API key
    }
  }

  // Try API key (for company API calls)
  try {
    await authenticateAPIKey(req, res, next);
  } catch (err) {
    return res.status(401).json({ error: 'Authentication required' });
  }
};

/**
 * GET /files/:chatbotId
 * Get knowledge base files for a chatbot
 */
router.get('/files/:chatbotId', authenticateFlexible, async (req, res) => {
  try {
    const { chatbotId } = req.params;

    let query = { _id: chatbotId };
    // If API key auth, filter by company
    if (req.company) {
      query.company = req.company._id;
    }
    // Admin can access any chatbot

    const chatbot = await Chatbot.findOne(query);

    if (!chatbot) {
      return res.status(404).json({ error: 'Chatbot not found' });
    }

    // Format knowledge base items as files
    const files = (chatbot.knowledgeBase || []).map((kb, index) => ({
      _id: kb._id || `kb_${index}`,
      filename: kb.title || 'Untitled',
      title: kb.title,
      content: kb.content?.substring(0, 100) + '...', // Preview
      size: kb.content?.length || 0,
      uploadedAt: kb.metadata?.uploadedAt || chatbot.createdAt,
      source: kb.metadata?.source || 'manual_upload',
    }));

    res.json({
      success: true,
      files,
    });
  } catch (error) {
    logger.error('Get knowledge base files error:', error);
    res.status(500).json({ error: 'Failed to get files' });
  }
});

/**
 * DELETE /files/:fileId
 * Delete a knowledge base file
 */
router.delete('/files/:fileId', authenticateFlexible, async (req, res) => {
  try {
    const { fileId } = req.params;
    const { chatbotId } = req.query; // chatbotId should be in query params

    if (!chatbotId) {
      return res.status(400).json({ error: 'chatbotId is required in query params' });
    }

    let query = { _id: chatbotId };
    if (req.company) {
      query.company = req.company._id;
    }

    const chatbot = await Chatbot.findOne(query);

    if (!chatbot) {
      return res.status(404).json({ error: 'Chatbot not found' });
    }

    // Find the knowledge base item to get its metadata for deletion
    const kbItem = chatbot.knowledgeBase.find(kb => {
      const kbId = kb._id?.toString() || String(kb._id);
      return kbId === fileId.toString();
    });

    // Remove from Embedding collection - only chunks for THIS file (by kbFileId when present)
    if (kbItem) {
      const allowedDashboardSources = ['manual_upload', 'file_upload'];
      const itemSource = kbItem.metadata?.source;

      if (itemSource && !allowedDashboardSources.includes(itemSource)) {
        logger.info(`[Delete KB] Skipping Embedding.deleteMany for non-dashboard source: ${itemSource}`);
      } else {
        let deleteQuery = { chatbotId: chatbot._id };

        if (itemSource && allowedDashboardSources.includes(itemSource)) {
          deleteQuery['metadata.source'] = itemSource;
        } else if (!itemSource) {
          deleteQuery['metadata.source'] = { $in: allowedDashboardSources };
        }

        const kbFileId = kbItem.metadata?.kbFileId;
        if (kbFileId) {
          deleteQuery['metadata.kbFileId'] = kbFileId;
          const deleteResult = await Embedding.deleteMany(deleteQuery);
          logger.info(`Deleted ${deleteResult.deletedCount} embedding chunks for file (kbFileId): ${kbItem.title}`);
        } else {
          deleteQuery.$or = [
            ...(kbItem.title ? [{ 'metadata.title': kbItem.title }] : []),
            ...(kbItem.metadata?.filename ? [{ 'metadata.filename': kbItem.metadata.filename }] : []),
          ];
          if (kbItem.content) deleteQuery.$or.push({ content: kbItem.content });
          if (deleteQuery.$or.length === 0) {
            logger.warn(`[Delete KB] No title/filename/content for legacy file; skipping embedding delete`);
          } else {
            const deleteResult = await Embedding.deleteMany(deleteQuery);
            logger.info(`Deleted ${deleteResult.deletedCount} embedding chunks for file (legacy): ${kbItem.title}`);
          }
        }
      }
    }

    // Remove the knowledge base item
    const initialLength = chatbot.knowledgeBase.length;
    chatbot.knowledgeBase = chatbot.knowledgeBase.filter(
      (kb) => {
        const kbId = kb._id?.toString() || String(kb._id);
        const targetId = fileId.toString();
        return kbId !== targetId;
      }
    );

    if (chatbot.knowledgeBase.length === initialLength) {
      return res.status(404).json({ error: 'File not found in knowledge base' });
    }

    await chatbot.save();

    res.json({
      success: true,
      message: 'File deleted successfully',
    });
  } catch (error) {
    logger.error('Delete knowledge base file error:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

/**
 * POST /files/:chatbotId
 * Upload knowledge base files/content
 */
router.post('/files/:chatbotId', authenticateFlexible, async (req, res) => {
  try {
    const { chatbotId } = req.params;
    const { title, content, metadata } = req.body;

    if (!title || !content) {
      return res.status(400).json({ error: 'title and content are required' });
    }

    let query = { _id: chatbotId };
    // If API key auth, filter by company
    if (req.company) {
      query.company = req.company._id;
    }
    // Admin can access any chatbot

    const chatbot = await Chatbot.findOne(query);

    if (!chatbot) {
      return res.status(404).json({ error: 'Chatbot not found' });
    }

    // Chunk the content if it's too large
    const chunks = chunkText(content);
    logger.info(`[Upload /files/:chatbotId] Content split into ${chunks.length} chunks`);

    // Generate embeddings for all chunks
    logger.info(`[Upload /files/:chatbotId] Generating embeddings for ${chunks.length} chunks...`);
    const embeddingPromises = chunks.map((chunk, index) => {
      logger.info(`[Upload /files/:chatbotId] Generating embedding for chunk ${index + 1}/${chunks.length} (length: ${chunk.length} chars)`);
      return embeddingService.generateEmbedding(chunk)
        .then(embedding => {
          logger.info(`[Upload /files/:chatbotId] ✅ Chunk ${index + 1} embedding generated (length: ${embedding.length})`);
          return embedding;
        })
        .catch(err => {
          logger.error(`[Upload /files/:chatbotId] ❌ Embedding generation error for chunk ${index + 1}:`, err);
          return null;
        });
    });

    const embeddings = await Promise.all(embeddingPromises);
    logger.info(`[Upload /files/:chatbotId] Generated ${embeddings.filter(e => e !== null).length}/${chunks.length} embeddings successfully`);

    // Filter out failed embeddings
    const validChunks = chunks.filter((_, index) => embeddings[index] !== null);
    const validEmbeddings = embeddings.filter(emb => emb !== null);

    if (validChunks.length === 0) {
      return res.status(500).json({ error: 'Failed to generate embeddings for any chunks' });
    }

    const kbFileId = new mongoose.Types.ObjectId();

    // Save all chunks to Embedding collection
    const embeddingDocs = validChunks.map((chunk, index) => ({
      chatbotId: chatbot._id,
      content: chunk,
      embedding: validEmbeddings[index],
      metadata: {
        source: metadata?.source || 'manual_upload',
        title: title,
        chunkIndex: index,
        ...metadata,
        kbFileId,
      },
    }));

    logger.info(`[Upload /files/:chatbotId] Saving ${embeddingDocs.length} embedding documents to database...`);
    logger.info(`[Upload /files/:chatbotId] ChatbotId being used: ${chatbot._id} (type: ${typeof chatbot._id})`);

    const insertResult = await Embedding.insertMany(embeddingDocs);
    logger.info(`[Upload /files/:chatbotId] ✅ Saved ${insertResult.length} embedding chunks to database`);

    // Verify the documents were saved
    const verifyCount = await Embedding.countDocuments({ chatbotId: chatbot._id });
    logger.info(`[Upload /files/:chatbotId] Verification: ${verifyCount} total embeddings now exist for this chatbot`);

    // Also add to knowledge base for backward compatibility (store first chunk as reference)
    const knowledgeItem = {
      title,
      content: validChunks[0], // Store first chunk
      embedding: validEmbeddings[0],
      metadata: {
        source: metadata?.source || 'manual_upload',
        uploadedAt: new Date(),
        totalChunks: validChunks.length,
        ...metadata,
        kbFileId,
      },
    };

    chatbot.knowledgeBase.push(knowledgeItem);
    await chatbot.save();

    scheduleKbReseed(chatbot._id);

    const addedItem = chatbot.knowledgeBase[chatbot.knowledgeBase.length - 1];

    res.status(201).json({
      success: true,
      data: addedItem,
      chunksStored: validChunks.length,
    });
  } catch (error) {
    logger.error('Upload knowledge file error:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

/**
 * POST /upload-file
 * Upload file via multipart form data (for admin dashboard)
 */
router.post('/upload-file', authenticateFlexible, upload.single('file'), async (req, res) => {
  try {
    const { chatbotId } = req.body;
    const file = req.file;

    if (!chatbotId) {
      return res.status(400).json({ error: 'chatbotId is required' });
    }

    if (!file) {
      return res.status(400).json({ error: 'File is required' });
    }

    let query = { _id: chatbotId };
    if (req.company) {
      query.company = req.company._id;
    }

    const chatbot = await Chatbot.findOne(query);

    if (!chatbot) {
      return res.status(404).json({ error: 'Chatbot not found' });
    }

    // Read file content based on type
    let content = '';
    const fileBuffer = file.buffer || Buffer.from(file.data || '');

    try {
      if (
        file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        file.originalname?.toLowerCase().endsWith('.docx')
      ) {
        // Handle DOCX
        const mammoth = require('mammoth');
        const result = await mammoth.extractRawText({ buffer: fileBuffer });
        content = result.value;
        if (result.messages && result.messages.length > 0) {
          logger.warn('Mammoth messages:', result.messages);
        }
      } else if (
        file.mimetype === 'application/pdf' ||
        file.originalname?.toLowerCase().endsWith('.pdf')
      ) {
        // Handle PDF
        const parser = new PDFParseClass({ data: fileBuffer });
        const result = await parser.getText();
        content = result.text;
        await parser.destroy();
      } else {
        // Handle Text / Fallback
        content = fileBuffer.toString('utf-8');

        // Check if content appears to be binary (common binary file signatures)
        // We only check this if we treated it as text
        const binarySignatures = [
          Buffer.from([0x50, 0x4B, 0x03, 0x04]), // ZIP (PK..)
          Buffer.from([0xD0, 0xCF, 0x11, 0xE0]), // Old Office format (doc, xls, ppt)
          Buffer.from([0x25, 0x50, 0x44, 0x46]), // PDF header (%PDF) - should be handled above
        ];

        const isBinary = binarySignatures.some(sig => fileBuffer.slice(0, sig.length).equals(sig)) ||
          /[\x00-\x08\x0E-\x1F]/.test(content.substring(0, 1000)); // Check for null bytes or control chars

        if (isBinary) {
          logger.error(`Binary file upload rejected: ${file.originalname}, mimetype: ${file.mimetype}`);
          return res.status(400).json({
            error: 'File appears to be binary or unsupported format. Supported formats: .txt, .md, .docx, .pdf'
          });
        }
      }

      if (content.length < 10) {
        return res.status(400).json({ error: 'File content is empty or too short.' });
      }

    } catch (err) {
      logger.error('File parsing error:', err);
      return res.status(400).json({ error: 'Failed to extract text from file: ' + err.message });
    }

    // Chunk the content if it's too large
    const chunks = chunkText(content);
    logger.info(`[Upload /upload-file] File split into ${chunks.length} chunks`);

    // Generate embeddings for all chunks
    logger.info(`[Upload /upload-file] Generating embeddings for ${chunks.length} chunks...`);
    const embeddingPromises = chunks.map((chunk, index) => {
      logger.info(`[Upload /upload-file] Generating embedding for chunk ${index + 1}/${chunks.length} (length: ${chunk.length} chars)`);
      return embeddingService.generateEmbedding(chunk)
        .then(embedding => {
          logger.info(`[Upload /upload-file] ✅ Chunk ${index + 1} embedding generated (length: ${embedding.length})`);
          return embedding;
        })
        .catch(err => {
          logger.error(`[Upload /upload-file] ❌ Embedding generation error for chunk ${index + 1}:`, err);
          return null;
        });
    });

    const embeddings = await Promise.all(embeddingPromises);
    logger.info(`[Upload /upload-file] Generated ${embeddings.filter(e => e !== null).length}/${chunks.length} embeddings successfully`);

    // Filter out failed embeddings
    const validChunks = chunks.filter((_, index) => embeddings[index] !== null);
    const validEmbeddings = embeddings.filter(emb => emb !== null);

    if (validChunks.length === 0) {
      return res.status(500).json({ error: 'Failed to generate embeddings for any chunks' });
    }

    const kbFileId = new mongoose.Types.ObjectId();

    // Save all chunks to Embedding collection
    const embeddingDocs = validChunks.map((chunk, index) => ({
      chatbotId: chatbot._id,
      content: chunk,
      embedding: validEmbeddings[index],
      metadata: {
        source: 'file_upload',
        title: file.originalname || file.name || 'Uploaded File',
        filename: file.originalname || file.name,
        mimetype: file.mimetype,
        chunkIndex: index,
        kbFileId,
      },
    }));

    logger.info(`[Upload /upload-file] Saving ${embeddingDocs.length} embedding documents to database...`);
    logger.info(`[Upload /upload-file] ChatbotId being used: ${chatbot._id} (type: ${typeof chatbot._id})`);

    const insertResult = await Embedding.insertMany(embeddingDocs);
    logger.info(`[Upload /upload-file] ✅ Saved ${insertResult.length} embedding chunks to database`);

    // Verify the documents were saved
    const verifyCount = await Embedding.countDocuments({ chatbotId: chatbot._id });
    logger.info(`[Upload /upload-file] Verification: ${verifyCount} total embeddings now exist for this chatbot`);

    // Also add to knowledge base for backward compatibility (store first chunk as reference)
    const knowledgeItem = {
      title: file.originalname || file.name || 'Uploaded File',
      content: validChunks[0], // Store first chunk
      embedding: validEmbeddings[0],
      metadata: {
        source: 'file_upload',
        uploadedAt: new Date(),
        filename: file.originalname || file.name,
        mimetype: file.mimetype,
        totalChunks: validChunks.length,
        kbFileId,
      },
    };

    chatbot.knowledgeBase.push(knowledgeItem);
    await chatbot.save();

    scheduleKbReseed(chatbot._id);

    res.json({
      success: true,
      chunksStored: validChunks.length,
      message: `File uploaded successfully (split into ${validChunks.length} chunks)`,
    });
  } catch (error) {
    logger.error('Upload file error:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

/**
 * POST /embeddings
 * Direct embedding storage for crawler
 */
router.post('/embeddings', authenticateAPIKey, sensitiveLimiter, async (req, res) => {
  try {
    const { embeddings, companyId } = req.body; // Client still sends as companyId (argv[2] in python)

    if (!embeddings || !Array.isArray(embeddings) || embeddings.length === 0) {
      return res.status(400).json({ error: 'embeddings array is required' });
    }

    if (!companyId) {
      return res.status(400).json({ error: 'target ID (chatbotId) is required' });
    }

    const mongoose = require('mongoose');
    const crypto = require('crypto');
    const actualChatbotId = typeof companyId === 'string'
      ? new mongoose.Types.ObjectId(companyId)
      : companyId;

    // Normalize and ensure embeddings exist (auto-generate for crawler if needed)
    const processedEmbeddings = [];

    for (const [index, emb] of embeddings.entries()) {
      if (!emb || !emb.content || typeof emb.content !== 'string' || emb.content.trim().length === 0) {
        logger.warn(`[Embeddings API] Skipping entry ${index} - missing or empty content`);
        continue;
      }

      let finalEmbedding = Array.isArray(emb.embedding) ? emb.embedding : null;

      // Detect all-zero or missing embeddings (crawler placeholder) and generate on the backend
      const isZeroVector =
        Array.isArray(finalEmbedding) &&
        finalEmbedding.length > 0 &&
        finalEmbedding.every((v) => v === 0);

      if (!finalEmbedding || !Array.isArray(finalEmbedding) || finalEmbedding.length === 0 || isZeroVector) {
        try {
          logger.info(`[Embeddings API] Generating embedding on backend for entry ${index} (source: ${emb.metadata?.source || 'unknown'})`);
          finalEmbedding = await embeddingService.generateEmbedding(emb.content);
        } catch (genErr) {
          logger.error(`[Embeddings API] Failed to generate embedding for entry ${index}:`, genErr);
          continue;
        }
      }

      processedEmbeddings.push({
        ...emb,
        embedding: finalEmbedding,
      });
    }

    if (processedEmbeddings.length === 0) {
      return res.status(400).json({ error: 'No valid embeddings provided after processing' });
    }

    const finalNewDocs = [];
    let updatedCount = 0;
    let skippedCount = 0;

    for (const emb of processedEmbeddings) {
      const contentHash = emb.contentHash || crypto.createHash('md5').update(emb.content).digest('hex');
      const targetUrl = emb.metadata?.url;

      const isZeroVector =
        Array.isArray(emb.embedding) &&
        emb.embedding.length > 0 &&
        emb.embedding.every((v) => v === 0);

      if (targetUrl) {
        const existingByUrl = await Embedding.findOne({
          chatbotId: actualChatbotId,
          'metadata.url': targetUrl
        });

        if (existingByUrl) {
          const existingIsZeroVector =
            Array.isArray(existingByUrl.embedding) &&
            existingByUrl.embedding.length > 0 &&
            existingByUrl.embedding.every((v) => v === 0);

          // If content is unchanged AND existing embedding is already non-zero, skip
          if (existingByUrl.contentHash === contentHash && !existingIsZeroVector) {
            skippedCount++;
            continue;
          }

          // Otherwise, update content/embedding (fix zero-vector or changed content)
          await Embedding.updateOne(
            { _id: existingByUrl._id },
            {
              $set: {
                content: emb.content,
                embedding: emb.embedding,
                contentHash: contentHash,
                'metadata.updatedAt': new Date(),
                'metadata.title': emb.metadata?.title || existingByUrl.metadata?.title
              }
            }
          );
          updatedCount++;
          continue;
        }
      }

      const existingByHash = await Embedding.findOne({
        chatbotId: actualChatbotId,
        contentHash: contentHash
      });

      if (existingByHash) {
        const existingIsZeroVector =
          Array.isArray(existingByHash.embedding) &&
          existingByHash.embedding.length > 0 &&
          existingByHash.embedding.every((v) => v === 0);

        if (!existingIsZeroVector) {
          skippedCount++;
          continue;
        }

        // Same content but bad embedding – fix it in-place
        await Embedding.updateOne(
          { _id: existingByHash._id },
          {
            $set: {
              content: emb.content,
              embedding: emb.embedding,
              contentHash: contentHash,
              'metadata.updatedAt': new Date(),
              'metadata.title': emb.metadata?.title || existingByHash.metadata?.title
            }
          }
        );
        updatedCount++;
        continue;
      }

      finalNewDocs.push({
        ...emb,
        chatbotId: actualChatbotId,
        contentHash: contentHash
      });
    }

    let storedCount = 0;
    if (finalNewDocs.length > 0) {
      const insertResult = await Embedding.insertMany(finalNewDocs);
      storedCount = insertResult.length;
    }

    logger.info(`[Embeddings API] ✅ Crawler sync for chatbot ${actualChatbotId}: ${storedCount} new, ${updatedCount} updated, ${skippedCount} skipped`);

    if (storedCount > 0 || updatedCount > 0) {
      scheduleKbReseed(actualChatbotId);
    }

    res.json({
      success: true,
      stored: storedCount,
      updated: updatedCount,
      skipped: skippedCount,
      message: `Sync complete: ${storedCount} new, ${updatedCount} updated, ${skippedCount} skipped.`
    });

  } catch (error) {
    logger.error('[Embeddings API] Error storing embeddings:', error);
    res.status(500).json({ error: 'Failed to store embeddings', details: error.message });
  }
});

router.use(sensitiveLimiter);

module.exports = router;

