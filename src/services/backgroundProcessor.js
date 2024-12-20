const { optimizeImage } = require('../utils/imageProcessor');
const { uploadMedia, updatePostWithMedia } = require('../utils/wordPressClient');
const { sendAppraisalNotification } = require('../utils/emailService');
const { logError } = require('../utils/errorLogger');
const { backupFiles } = require('../utils/storageClient');
const axios = require('axios');

async function processImagesAndUpdate({ files, postId, config, metadata }) {
  try {
    console.log('Starting background processing for post:', postId);

    // Start GCS backup in parallel - don't await
    const backupPromise = backupFiles(files, config, {
      session_id: metadata.session_id,
      customer_email: metadata.customer_email,
      post_id: postId
    });

    // Process and optimize images
    const processedImages = await processImages(files);
    console.log('Images processed successfully');

    // Upload images to WordPress
    const uploadedMedia = await uploadToWordPress(processedImages, config);
    console.log('Images uploaded to WordPress:', uploadedMedia);

    // Update post with media
    await updatePostWithMedia(postId, {
      meta: {
        processing_status: 'completed',
        main: uploadedMedia.main?.id || '',         // ACF field for main image
        signature: uploadedMedia.signature?.id || '', // ACF field for signature image
        age: uploadedMedia.age?.id || ''            // ACF field for age image
      }
    }, config);

    // Check GCS backup results without blocking
    const backupUrls = await backupPromise;
    console.log('GCS backup completed:', backupUrls);

    console.log('Post updated with media IDs');
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
        processing_status: 'error',
        error_message: error.message,
        main: '',
        signature: '',
        age: ''
      }
    }, config).catch(console.error);
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
}

module.exports = {
  processImagesAndUpdate
};