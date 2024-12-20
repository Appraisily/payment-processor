const stripeModule = require('stripe');
const { createInitialPost, updatePostWithMedia } = require('../utils/wordPressClient');
const { processImagesAndUpdate } = require('./backgroundProcessor');

async function processAppraisalSubmission(req, config) {
  const {
    session_id,
    description
  } = req.body;

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

    // Start background processing
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

    return {
      postId: post.id,
      postUrl: post.editUrl
    };
  } catch (error) {
    console.error('Error in processAppraisalSubmission:', error);
    throw error;
  }
}

module.exports = {
  processAppraisalSubmission
};