const express = require('express');
const multer = require('multer');
const AppraisalService = require('../domain/appraisal/service');
const { logError } = require('../utils/error/logger');

function setupAppraisalRoutes(app, config) {
  const router = express.Router();
  const appraisalService = new AppraisalService(config);

  const upload = multer({
    limits: {
      fileSize: 10 * 1024 * 1024,
      files: 3
    }
  });

  const uploadFields = [
    { name: 'main', maxCount: 1 },
    { name: 'signature', maxCount: 1 },
    { name: 'age', maxCount: 1 }
  ];

  router.post('/', upload.fields(uploadFields), async (req, res) => {
    console.log('Received appraisal submission request');

    try {
      const submission = {
        session_id: req.body.session_id,
        description: req.body.description,
        files: req.files,
        customer_email: req.body.email,
        customer_name: req.body.name,
        payment_id: req.body.payment_id
      };

      const result = await appraisalService.processSubmission(submission);

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error processing appraisal submission:', error);
      await logError(config, {
        severity: 'Error',
        scriptName: 'appraisalRoutes',
        errorCode: error.code || 'APPRAISAL_SUBMISSION_ERROR',
        errorMessage: error.message,
        stackTrace: error.stack,
        userId: req.body.email,
        endpoint: '/api/appraisals',
        additionalContext: JSON.stringify({
          session_id: req.body.session_id,
          hasFiles: !!req.files
        })
      });

      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  app.use('/api/appraisals', router);
}