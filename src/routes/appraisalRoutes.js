const express = require('express');
const multer = require('multer');
const { processAppraisalSubmission } = require('../services/appraisalProcessor');
const { validateAppraisalRequest } = require('../utils/validators');
const { logError } = require('../utils/errorLogger');
const { backupFiles } = require('../utils/storageClient');

function setupAppraisalRoutes(app, config) {
  const router = express.Router();

  // Configure multer for file uploads
  const upload = multer({
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB limit
      files: 3 // Maximum 3 files (main, signature, age)
    }
  });

  // Define the fields for multipart form data
  const uploadFields = [
    { name: 'main', maxCount: 1 },
    { name: 'signature', maxCount: 1 },
    { name: 'age', maxCount: 1 }
  ];

  router.post('/', upload.fields(uploadFields), async (req, res) => {
    console.log('Received appraisal submission request');

    try {
      // Validate request parameters
      const validationError = validateAppraisalRequest(req);
      if (validationError) {
        return res.status(400).json({
          success: false,
          error: validationError
        });
      }

      // Send immediate success response
      res.status(200).json({
        success: true,
        message: 'Processing started'
      });

      // Process the submission
      processAppraisalSubmission(req, config).catch(error => {
        console.error('Background processing error:', error);
        logError(config, {
          severity: 'Error',
          scriptName: 'appraisalRoutes',
          errorCode: error.code || 'BACKGROUND_PROCESSING_ERROR',
          errorMessage: error.message,
          stackTrace: error.stack,
          userId: req.body.customer_email,
          additionalContext: JSON.stringify({
            session_id: req.body.session_id,
            hasFiles: !!req.files
          })
        }).catch(console.error);
      });

    } catch (error) {
      console.error('Error processing appraisal submission:', error);

      // Log the error
      await logError(config, {
        timestamp: new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' }),
        severity: 'Error',
        scriptName: 'appraisalRoutes',
        errorCode: error.code || 'APPRAISAL_SUBMISSION_ERROR',
        errorMessage: error.message,
        stackTrace: error.stack,
        userId: req.body.customer_email,
        requestId: req.headers['x-request-id'] || '',
        environment: 'Production',
        endpoint: '/api/appraisals',
        additionalContext: JSON.stringify({
          session_id: req.body.session_id,
          hasMainImage: !!req.files?.main
        }),
        resolutionStatus: 'Open'
      });

      // Send error response
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Mount the router
  app.use('/api/appraisals', router);
}

module.exports = {
  setupAppraisalRoutes
};