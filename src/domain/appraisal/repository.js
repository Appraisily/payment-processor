const { createPost, uploadMedia, updatePost } = require('../../infrastructure/wordpress/client');
const GCSClient = require('../../infrastructure/storage/gcs');
const { optimizeImages } = require('../../infrastructure/image/processor');
const { logError } = require('../../utils/error/logger');

class AppraisalRepository {
  constructor(config) {
    this.config = config;
    this.gcsClient = new GCSClient(config);
  }

  async createAppraisal(submission) {
    const { session_id, files, customer_email, customer_name } = submission;
    let uploadedMedia = {};

    try {
      // Start file backup early using GCS client
      const backupPromise = files ? this.gcsClient.backupFiles(files, {
        session_id,
        customer_email,
        post_id: 'pending'
      }) : Promise.resolve(null);

      // Create WordPress post
      const post = await createPost({
        title: `Art Appraisal Request - ${session_id}`,
        content: ' ',
        type: 'appraisals',
        status: 'draft',
        meta: {
          session_id,
          customer_email,
          customer_name,
          main: '',
          signature: '',
          age: ''
        }
      }, this.config);

      // Process images if any
      if (files) {
        const processedImages = await optimizeImages(files);
        const uploadedMedia = await this.uploadAllMedia(processedImages);
        await this.updatePostMedia(post.id, uploadedMedia);
      }

      // Wait for backup to complete
      const backupUrls = await backupPromise;

      return {
        id: post.id,
        editUrl: post.editUrl,
        media: uploadedMedia,
        backupUrls
      };

    } catch (error) {
      await logError(this.config, {
        severity: 'Error',
        scriptName: 'AppraisalRepository',
        errorCode: 'APPRAISAL_CREATION_ERROR',
        errorMessage: error.message,
        stackTrace: error.stack,
        additionalContext: JSON.stringify({ session_id })
      });
      throw error;
    }
  }

  async uploadAllMedia(processedImages) {
    const uploadedMedia = {};
    for (const [key, buffer] of Object.entries(processedImages)) {
      uploadedMedia[key] = await uploadMedia(
        buffer,
        `${key}-${Date.now()}.jpg`,
        this.config
      );
    }
    return uploadedMedia;
  }

  async updatePostMedia(postId, media) {
    return await updatePost(postId, {
      meta: {
        main: media.main?.id || '',
        signature: media.signature?.id || '',
        age: media.age?.id || ''
      }
    }, this.config);
  }
}

module.exports = AppraisalRepository;