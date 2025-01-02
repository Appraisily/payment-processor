const { createPost, uploadMedia, updatePost } = require('../../infrastructure/wordpress/client');
const GCSClient = require('../../infrastructure/storage/gcs');
const { optimizeImages } = require('../../infrastructure/image/processor');
const { logError } = require('../../utils/error/logger');
const AppraisalSheetsClient = require('../../infrastructure/sheets/appraisals');
const AppraisersBackendClient = require('../../infrastructure/appraisers/client');

class AppraisalRepository {
  constructor(config) {
    this.config = config;
    this.gcsClient = new GCSClient(config);
    this.sheetsClient = new AppraisalSheetsClient(config);
    this.appraisersClient = new AppraisersBackendClient(config);
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

      // Record in Google Sheets
      await this.sheetsClient.recordSubmission({
        session_id,
        customer_email,
        customer_name,
        wordpressEditUrl: post.editUrl
      });

      // Process images if any
      if (files) {
        const processedImages = await optimizeImages(files);
        uploadedMedia = await this.uploadAllMedia(processedImages);
        await this.updatePostMedia(post.id, {
          media: uploadedMedia,
          customer_name,
          customer_email,
          session_id
        });

        // Notify appraisers backend
        await this.appraisersClient.notifySubmission({
          session_id,
          customer_email,
          customer_name,
          description: submission.description,
          payment_id: submission.payment_id,
          wordpress_url: post.editUrl,
          images: uploadedMedia
        });
        
        // Update sheets status after media upload
        await this.sheetsClient.updateSubmissionStatus(session_id, post.editUrl);
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
        timestamp: new Date().toISOString(),
        severity: 'Error',
        scriptName: 'AppraisalRepository',
        errorCode: 'APPRAISAL_CREATION_ERROR',
        errorMessage: error.message,
        stackTrace: error.stack,
        additionalContext: JSON.stringify({ 
          session_id,
          hasFiles: !!files,
          error: error.response?.data || error.message
        })
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

  async updatePostMedia(postId, data) {
    return await updatePost(postId, {
      meta: {
        // Media IDs
        main: data.media.main?.id || '',
        signature: data.media.signature?.id || '',
        age: data.media.age?.id || '',
        // Customer information
        customer_name: data.customer_name,
        customer_email: data.customer_email,
        session_id: data.session_id
      }
    }, this.config);
  }
}

module.exports = AppraisalRepository;