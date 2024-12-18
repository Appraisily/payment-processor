const { optimizeImage } = require('../utils/imageProcessor');
const { uploadMedia, updatePostWithMedia } = require('../utils/wordPressClient');
const { sendAppraisalNotification } = require('../utils/emailService');
const { logError } = require('../utils/errorLogger');
const axios = require('axios');

async function processImagesAndUpdate({ files, postId, config, metadata }) {
  try {
    // Process and optimize images
    const processedImages = await processImages(files);

    // Upload images to WordPress
    const uploadedMedia = await uploadToWordPress(processedImages, config);

    // Update post with media
    await updatePostWithMedia(postId, {
      meta: {
        processing_status: 'completed',
        main: uploadedMedia.main?.id || '',         // ACF field for main image
        signature: uploadedMedia.signature?.id || '', // ACF field for signature image
        age: uploadedMedia.age?.id || ''            // ACF field for age image
      }
    }, config);

    // Send notification email
    await sendAppraisalNotification({
      config,
      customerEmail: metadata.customer_email,
      customerName: metadata.customer_name,
      sessionId: metadata.session_id,
      postUrl: `${config.WORDPRESS_ADMIN_URL}/post.php?post=${postId}&action=edit`
    });

    // Prepare data for appraisers-backend
    const backendPayload = {
      session_id: metadata.session_id,
      customer_email: metadata.customer_email,
      customer_name: metadata.customer_name || '',
      description: metadata.description || '',
      payment_id: metadata.payment_id || '',
      wordpress_url: `${config.WORDPRESS_ADMIN_URL}/post.php?post=${postId}&action=edit`,
      images: {
        main: uploadedMedia.main?.url || '',
        age: uploadedMedia.age?.url || '',
        signature: uploadedMedia.signature?.url || ''
      }
    };

    // Send request to appraisers-backend
    try {
      await axios.post(
        'https://appraisers-backend-856401495068.us-central1.run.app/api/update-pending-appraisal',
        backendPayload,
        {
          headers: {
            'Content-Type': 'application/json',
            'x-shared-secret': config.STRIPE_SHARED_SECRET
          },
          timeout: 10000 // 10 second timeout
        }
      );
      console.log('Successfully notified appraisers-backend');
    } catch (backendError) {
      console.error('Error notifying appraisers-backend:', backendError);
      await logError(config, {
        severity: 'Warning',
        scriptName: 'backgroundProcessor',
        errorCode: 'BACKEND_NOTIFICATION_ERROR',
        errorMessage: backendError.message,
        stackTrace: backendError.stack,
        userId: metadata.customer_email,
        additionalContext: JSON.stringify({
          postId,
          session_id: metadata.session_id,
          response: backendError.response?.data
        })
      });
      // Continue execution - don't throw error as the main process succeeded
    }

  } catch (error) {
    console.error('Error in background processing:', error);
    await logError(config, {
      severity: 'Error',
      scriptName: 'backgroundProcessor',
      errorCode: 'BACKGROUND_PROCESSING_ERROR',
      errorMessage: error.message,
      stackTrace: error.stack,
      userId: metadata.customer_email,
      additionalContext: JSON.stringify({
        postId,
        session_id: metadata.session_id
      })
    });

    // Update post to indicate error
    await updatePostWithMedia(postId, {
      meta: {
        processing_status: 'error',
        error_message: error.message,
        main: '',
        signature: '',
        age: ''
      }
    }, config).catch(console.error);
  }

async function processImages(files) {
  const processedImages = {};
  for (const [key, fileArray] of Object.entries(files)) {
    if (fileArray && fileArray[0]) {
      processedImages[key] = await optimizeImage(fileArray[0].buffer);
    }
  }
  return processedImages;
}

async function uploadToWordPress(images, config) {
  const uploadedMedia = {};
  for (const [key, buffer] of Object.entries(images)) {
    uploadedMedia[key] = await uploadMedia(buffer, `${key}-${Date.now()}.jpg`, config);
  }
  return uploadedMedia;
}
}

module.exports = {
  processImagesAndUpdate
};