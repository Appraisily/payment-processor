const express = require('express');
const multer = require('multer');
const { processAppraisalSubmission } = require('../services/appraisalProcessor');
const { validateAppraisalRequest } = require('../utils/validators');
const { logError } = require('../utils/errorLogger');

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

      // Process the submission
      await processAppraisalSubmission(req, config, res);

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

      // Only send error response if one hasn't been sent yet
      if (!res.headersSent) {
        res.status(500).json({
        success: false,
        error: error.message
      });
      }
    }
  });

  // Mount the router
  app.use('/api/appraisals', router);
}

module.exports = {
  setupAppraisalRoutes
};