const { optimizeImage } = require('../infrastructure/image/processor');
const { uploadMedia } = require('../infrastructure/wordpress/media');
const { updatePost } = require('../infrastructure/wordpress/posts');
const SendGridClient = require('../infrastructure/email/sendgrid');
const { logError } = require('../utils/error/logger');
const GCSClient = require('../infrastructure/storage/gcs');
const axios = require('axios');

async function processImagesAndUpdate({ files, postId, config, backupPromise, metadata }) {
  try {
    console.log('Starting background processing for post:', postId);

    // If we have an existing backup promise, wait for it
    let backupUrls;
    if (backupPromise) {
      console.log('Waiting for existing backup to complete');
      backupUrls = await backupPromise;
    }

    // Process and optimize images
    const processedImages = await processImages(files);
    console.log('Images processed successfully');

    // Upload images to WordPress
    const uploadedMedia = await uploadToWordPress(processedImages, config);
    console.log('Images uploaded to WordPress:', uploadedMedia);

    // Update post with media
    await updatePostWithMedia(postId, {
      meta: {
        main: uploadedMedia.main?.id || '',
        signature: uploadedMedia.signature?.id || '',
        age: uploadedMedia.age?.id || ''
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
    console.log('Notification email sent');

    // Prepare data for appraisers-backend
    const backendPayload = {
      session_id: metadata.session_id,
      customer_email: metadata.customer_email,
      post_id: postId.toString(),
      post_edit_url: `${config.WORDPRESS_ADMIN_URL}/post.php?post=${postId}&action=edit`,
      description: metadata.description || '',
      images: {
        main: uploadedMedia.main?.url || '',
        age: uploadedMedia.age?.url || '',
        signature: uploadedMedia.signature?.url || ''
      }
    };

    // Send request to appraisers-backend
    try {
      await axios.post(
        config.APPRAISERS_BACKEND_URL || 'https://appraisers-backend-856401495068.us-central1.run.app/api/update-pending-appraisal',
        backendPayload,
        {
          headers: {
            'Content-Type': 'application/json',
            'x-shared-secret': config.SHARED_SECRET
          },
          timeout: 10000 // 10 second timeout
        }
      );
      console.log('Successfully notified appraisers-backend');
    } catch (backendError) {
      console.error('Error notifying appraisers-backend:', {
        message: backendError.message,
        response: backendError.response?.data,
        status: backendError.response?.status
      });
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
        main: '',
        signature: '',
        age: ''
      }
    }, config).catch(console.error);
  }
}

async function processImages(files) {
  console.log('Processing images:', Object.keys(files));
  const processedImages = {};
  for (const [key, fileArray] of Object.entries(files)) {
    if (fileArray && fileArray[0]) {
      console.log(`Processing ${key} image`);
      processedImages[key] = await optimizeImage(fileArray[0].buffer);
      console.log(`${key} image processed successfully`);
    }
  }
  return processedImages;
}

async function uploadToWordPress(images, config) {
  console.log('Uploading images to WordPress:', Object.keys(images));
  const uploadedMedia = {};
  for (const [key, buffer] of Object.entries(images)) {
    console.log(`Uploading ${key} image`);
    uploadedMedia[key] = await uploadMedia(buffer, `${key}-${Date.now()}.jpg`, config);
    console.log(`${key} image uploaded successfully:`, uploadedMedia[key].id);
  }
  return uploadedMedia;
}

module.exports = {
  processImagesAndUpdate
};