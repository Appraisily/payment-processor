const express = require('express');
const multer = require('multer');
const BulkAppraisalService = require('../domain/bulk-appraisal/service');
const { logError } = require('../utils/error/logger');

function setupBulkAppraisalRoutes(app, config) {
  const router = express.Router();
  const bulkAppraisalService = new BulkAppraisalService(config);

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 10 * 1024 * 1024,
      files: 1
    }
  });

  router.post('/init', async (req, res) => {
    try {
      const { session_id, expires_at } = await bulkAppraisalService.initializeSession();
      
      res.status(200).json({
        success: true,
        session_id,
        expires_at
      });
    } catch (error) {
      console.error('Error initializing bulk session:', error);
      await logError(config, {
        severity: 'Error',
        scriptName: 'bulkAppraisalRoutes',
        errorCode: 'BULK_SESSION_INIT_ERROR',
        errorMessage: error.message,
        stackTrace: error.stack
      });
      
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: 'Failed to initialize bulk session'
        });
      }
    }
  });

  router.post('/upload/:sessionId', upload.single('file'), async (req, res) => {
    const { sessionId } = req.params;
    const { description, category, position } = req.body;
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file provided'
      });
    }

    try {
      const { file_id, url } = await bulkAppraisalService.uploadFile(sessionId, req.file, {
        description,
        category,
        position: parseInt(position, 10)
      });

      console.log('File uploaded successfully:', {
        session_id: sessionId,
        file_id,
        position,
        category
      });

      res.status(200).json({
        success: true,
        file_id,
        url
      });
    } catch (error) {
      console.error('Error uploading file:', error);
      await logError(config, {
        severity: 'Error',
        scriptName: 'bulkAppraisalRoutes',
        errorCode: 'FILE_UPLOAD_ERROR',
        errorMessage: error.message,
        stackTrace: error.stack,
        additionalContext: JSON.stringify({
          session_id: sessionId,
          filename: req.file?.originalname,
          position,
          category
        })
      });

      res.status(500).json({
        success: false,
        error: 'Failed to upload file'
      });
    }
  });

  router.delete('/upload/:sessionId/:fileId', async (req, res) => {
    const { sessionId, fileId } = req.params;

    try {
      await bulkAppraisalService.deleteFile(sessionId, fileId);

      res.status(200).json({
        success: true
      });
    } catch (error) {
      console.error('Error deleting file:', error);
      await logError(config, {
        severity: 'Error',
        scriptName: 'bulkAppraisalRoutes',
        errorCode: 'FILE_DELETE_ERROR',
        errorMessage: error.message,
        stackTrace: error.stack,
        additionalContext: JSON.stringify({
          session_id: sessionId,
          file_id: fileId
        })
      });

      const statusCode = error.message === 'File not found' ? 404 : 500;
      res.status(statusCode).json({
        success: false,
        error: error.message === 'File not found' ? 
          'File not found' : 
          'Failed to delete file'
      });
    }
  });

  router.get('/session/:sessionId', async (req, res) => {
    const { sessionId } = req.params;

    try {
      const result = await bulkAppraisalService.getSessionStatus(sessionId);

      res.status(200).json({
        success: true,
        ...result
      });
    } catch (error) {
      console.error('Error retrieving session status:', error);
      await logError(config, {
        severity: 'Error',
        scriptName: 'bulkAppraisalRoutes',
        errorCode: 'SESSION_STATUS_ERROR',
        errorMessage: error.message,
        stackTrace: error.stack,
        additionalContext: JSON.stringify({
          session_id: sessionId
        })
      });

      res.status(500).json({
        success: false,
        error: 'Failed to retrieve session status'
      });
    }
  });

  router.put('/session/:sessionId/email', express.json(), async (req, res) => {
    const { sessionId } = req.params;
    const { email } = req.body;

    if (!email || !email.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Email address is required'
      });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email address'
      });
    }

    try {
      await bulkAppraisalService.updateSessionEmail(sessionId, email);

      res.status(200).json({
        success: true,
        message: 'Email updated successfully'
      });
    } catch (error) {
      console.error('Error updating session email:', error);
      await logError(config, {
        severity: 'Error',
        scriptName: 'bulkAppraisalRoutes',
        errorCode: 'SESSION_EMAIL_UPDATE_ERROR',
        errorMessage: error.message,
        stackTrace: error.stack,
        additionalContext: JSON.stringify({
          session_id: sessionId
        })
      });

      const statusCode = error.message === 'Session not found' ? 404 : 500;
      res.status(statusCode).json({
        success: false,
        error: error.message
      });
    }
  });

  router.post('/finalize/:sessionId', express.json(), async (req, res) => {
    const { sessionId } = req.params;
    const { email, phone, notes } = req.body;

    try {
      const { checkout_url } = await bulkAppraisalService.finalizeSession(sessionId, {
        email,
        phone,
        notes
      });

      res.status(200).json({
        success: true,
        redirect_url: checkout_url
      });
    } catch (error) {
      console.error('Error finalizing bulk session:', error);
      await logError(config, {
        severity: 'Error',
        scriptName: 'bulkAppraisalRoutes',
        errorCode: 'BULK_SESSION_FINALIZE_ERROR',
        errorMessage: error.message,
        stackTrace: error.stack,
        additionalContext: JSON.stringify({
          session_id: sessionId,
          has_email: !!email,
          has_phone: !!phone,
          has_notes: !!notes
        })
      });

      const statusCode = error.message === 'No files uploaded in this session' ? 400 : 500;
      res.status(statusCode).json({
        success: false,
        error: error.message
      });
    }
  });

  app.use('/api/bulk-appraisals', router);
}

module.exports = setupBulkAppraisalRoutes;