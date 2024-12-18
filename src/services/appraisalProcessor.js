const { createInitialPost, updatePostWithMedia } = require('../utils/wordPressClient');
const { processImagesAndUpdate } = require('./backgroundProcessor');

async function processAppraisalSubmission(req, config) {
  const {
    session_id,
    customer_email,
    customer_name,
    description
  } = req.body;

  try {
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