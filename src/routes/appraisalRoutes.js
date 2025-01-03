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
    // Log raw request data
    console.log('Raw request data:', {
      body: req.body,
      files: req.files,
      headers: {
        'content-type': req.headers['content-type'],
        'content-length': req.headers['content-length']
      }
    });

    // Log complete request information
    console.log('Received appraisal submission request with body:', {
      session_id: req.body.session_id,
      description: req.body.description,
      customer_email: req.body.customer_email,
      customer_name: req.body.customer_name,
      files: req.files ? {
        main: req.files.main?.[0] ? {
          originalname: req.files.main[0].originalname,
          mimetype: req.files.main[0].mimetype,
          size: req.files.main[0].size
        } : undefined,
        signature: req.files.signature?.[0] ? {
          originalname: req.files.signature[0].originalname,
          mimetype: req.files.signature[0].mimetype,
          size: req.files.signature[0].size
        } : undefined,
        age: req.files.age?.[0] ? {
          originalname: req.files.age[0].originalname,
          mimetype: req.files.age[0].mimetype,
          size: req.files.age[0].size
        } : undefined
      } : {}
    });

    // Validate required fields
    if (!req.body.session_id) {
      console.error('Missing required session_id');
      return res.status(400).json({
        success: false,
        message: 'Missing required session_id'
      });
    }

    // Get customer info from Stripe session if not provided
    if (!req.body.customer_email || !req.body.customer_name) {
      try {
        const stripe = require('stripe')(config.STRIPE_SECRET_KEY_LIVE);
        const session = await stripe.checkout.sessions.retrieve(
          req.body.session_id,
          { expand: ['customer_details'] }
        );
        
        console.log('Retrieved Stripe session details:', {
          session_id: session.id,
          customer_email: session.customer_details?.email,
          customer_name: session.customer_details?.name
        });

        // Always use Stripe session data for customer details
        req.body.customer_email = session.customer_details?.email;
        req.body.customer_name = session.customer_details?.name;
      } catch (error) {
        console.error('Error retrieving Stripe session:', error);
      }
    }

    const submission = {
      session_id: req.body.session_id,
      description: req.body.description,
      files: req.files,
      customer_email: req.body.customer_email,
      customer_name: req.body.customer_name,
      payment_id: req.body.payment_id
    };

    console.log('Processing submission with:', {
      session_id: submission.session_id,
      customer_email: submission.customer_email,
      customer_name: submission.customer_name,
      hasFiles: !!submission.files,
      fileTypes: submission.files ? Object.keys(submission.files) : []
    });

    // Send immediate success response
    res.status(200).json({
      success: true,
      message: 'Submission received and processing started',
      session_id: submission.session_id
    });

    // Process submission in background
    try {
      console.log('Starting background processing for session:', submission.session_id);
      await appraisalService.processSubmission(submission);
      console.log('Background processing completed successfully');
    } catch (error) {
      console.error('Error processing appraisal submission:', error);
      await logError(config, {
        timestamp: new Date().toISOString(),
        severity: 'Error',
        scriptName: 'appraisalRoutes',
        errorCode: error.code || 'APPRAISAL_SUBMISSION_ERROR',
        errorMessage: error.message,
        stackTrace: error.stack,
        userId: req.body.customer_email,
        endpoint: '/api/appraisals',
        additionalContext: JSON.stringify({
          session_id: req.body.session_id,
          hasFiles: !!req.files,
          fileTypes: req.files ? Object.keys(req.files) : [],
          error: error.response?.data || error.message,
          status: error.response?.status,
          stack: error.stack
        })
      });
    }
  });

  app.use('/api/appraisals', router);
}

module.exports = {
  setupAppraisalRoutes
};