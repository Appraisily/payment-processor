const stripeModule = require('stripe');
const { createInitialPost, updatePostWithMedia } = require('../utils/wordPressClient');
const { processImagesAndUpdate } = require('./backgroundProcessor');

async function processAppraisalSubmission(req, config, res) {
  const {
    session_id,
    description
  } = req.body;

  // Send immediate 200 response
  res.status(200).json({
    success: true,
    message: 'Processing started'
  });

  try {
    // Initialize Stripe with the live key
    const stripe = stripeModule(config.STRIPE_SECRET_KEY_LIVE);
    
    // Retrieve the session
    const session = await stripe.checkout.sessions.retrieve(session_id, {
      expand: ['customer_details']
    });

    if (!session) {
      throw new Error('Session not found');
    }

    const customer_email = session.customer_details?.email;
    const customer_name = session.customer_details?.name;

    if (!customer_email) {
      throw new Error('Customer email not found in session');
    }

    // Create initial WordPress post immediately
    const postData = {
      title: `Appraisal Request - ${session_id}`,
      content: '',
      type: 'appraisals', // Custom post type
      status: 'draft',
      meta: {
        session_id,
        customer_email,
        customer_name: customer_name || '',
        customer_description: description || '',
        submission_date: new Date().toISOString(),
        processing_status: 'pending',
        main: '',           // Initialize ACF image fields
        signature: '',
        age: ''
      }
    };

    const post = await createInitialPost(postData, config);
    console.log('WordPress post created:', post.id);

    // Continue with background processing regardless of WordPress success
    processImagesAndUpdate({
      files: req.files,
      postId: post.id,
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
    });

  } catch (error) {
    console.error('Error in processAppraisalSubmission:', error);
    // Log error but continue since response was already sent
    await logError(config, {
      severity: 'Error',
      scriptName: 'appraisalProcessor',
      errorCode: 'PROCESSING_ERROR',
      errorMessage: error.message,
      stackTrace: error.stack,
      additionalContext: JSON.stringify({ session_id })
    }).catch(console.error); // Prevent error logging failures from breaking flow
  }
}

module.exports = {
  processAppraisalSubmission
};