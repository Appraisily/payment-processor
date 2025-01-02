const stripeModule = require('stripe');
const { createInitialPost, updatePostWithMedia } = require('../utils/wordPressClient');
const { processImagesAndUpdate } = require('./backgroundProcessor');
const { updateAppraisalStatus } = require('../utils/spreadsheetClient');
const { logError } = require('../utils/errorLogger');

async function processAppraisalSubmission(req, config, res) {
  const {
    session_id,
    description
  } = req.body;

  let stripeSession;
  let wordpressPost;

  try {
    // Step 1: Validate Stripe Session
    try {
      const stripe = stripeModule(config.STRIPE_SECRET_KEY_LIVE);
      stripeSession = await stripe.checkout.sessions.retrieve(session_id, {
        expand: ['customer_details']
      });
      console.log('Stripe session validated');
    } catch (error) {
      console.error('Stripe session validation failed:', error);
      await logError(config, {
        severity: 'Error',
        scriptName: 'appraisalProcessor',
        errorCode: 'STRIPE_VALIDATION_ERROR',
        errorMessage: error.message,
        stackTrace: error.stack,
        additionalContext: JSON.stringify({ session_id })
      });
      throw new Error('Invalid session ID');
    }

    // Get customer details, fallback to safe defaults
    const customer_email = stripeSession?.customer_details?.email || req.body.email || 'unknown@email';
    const customer_name = stripeSession?.customer_details?.name || req.body.name || 'Unknown Customer';

    // Send 200 response after validation but before processing
    res.status(200).json({
      success: true,
      message: 'Processing started'
    });

    // Step 2: Create WordPress Post
    try {
      const postData = {
        title: `Art Appraisal Request - ${session_id}`,
        content: '',
        type: 'appraisals',
        status: 'draft',
        meta: {
          session_id,
          customer_email: customer_email,
          customer_name: customer_name,
          main: '',
          signature: '',
          age: ''
        }
      };

      wordpressPost = await createInitialPost(postData, config);
      console.log('WordPress post created:', wordpressPost.id);

      // Update spreadsheet with WordPress URL immediately after post creation
      if (wordpressPost) {
        const wordpressEditUrl = `${config.WORDPRESS_ADMIN_URL}/post.php?post=${wordpressPost.id}&action=edit`;
        await updateAppraisalStatus(session_id, wordpressEditUrl, description, config);
        console.log('Spreadsheet updated with WordPress URL');
      }
    } catch (error) {
      console.error('WordPress post creation failed:', error);
      await logError(config, {
        severity: 'Error',
        scriptName: 'appraisalProcessor',
        errorCode: 'WORDPRESS_CREATE_ERROR',
        errorMessage: error.message,
        stackTrace: error.stack,
        additionalContext: JSON.stringify({ session_id, customer_email })
      });
      throw error; // Propagate error to ensure proper handling
    }

    // Step 3: Process Images
    if (wordpressPost && req.files) {
      processImagesAndUpdate({
        files: req.files,
        postId: wordpressPost.id,
        config,
        metadata: {
          session_id,
          customer_email,
          customer_name,
          description,
          payment_id: req.body.payment_id
        }
      }).catch(error => {
        console.error('Background processing error:', error);
        logError(config, {
          severity: 'Error',
          scriptName: 'appraisalProcessor',
          errorCode: 'BACKGROUND_PROCESSING_ERROR',
          errorMessage: error.message,
          stackTrace: error.stack,
          additionalContext: JSON.stringify({ 
            session_id,
            wordpress_post_id: wordpressPost.id,
            files: Object.keys(req.files)
          })
        }).catch(console.error);
      });
    }

  } catch (error) {
    console.error('Error in processAppraisalSubmission:', error);
    await logError(config, {
      severity: 'Error',
      scriptName: 'appraisalProcessor',
      errorCode: 'PROCESSING_ERROR',
      errorMessage: error.message,
      stackTrace: error.stack,
      additionalContext: JSON.stringify({ 
        session_id,
        stripe_session_exists: !!stripeSession,
        wordpress_post_exists: !!wordpressPost
      })
    }).catch(console.error); // Prevent error logging failures from breaking flow
  }
}

module.exports = {
  processAppraisalSubmission
};