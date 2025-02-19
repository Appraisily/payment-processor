const AppraisersBackendClient = require('../../../infrastructure/appraisers/client');

class AppraisersRepository {
  constructor(config) {
    this.config = config;
    this.appraisersClient = new AppraisersBackendClient(config);
  }

  async notifySubmission(submission, wordpressUrl, uploadedMedia) {
    try {
      // Extract post_id from WordPress URL
      const postId = wordpressUrl?.match(/post=(\d+)/)?.[1];
      
      if (!postId || !wordpressUrl) {
        throw new Error('Missing required WordPress post information');
      }

      const payload = {
        session_id: submission.session_id,
        customer_email: submission.customer_email || '',
        post_id: postId,
        post_edit_url: wordpressUrl,
        images: {
          main: uploadedMedia.main?.url || '',
          signature: uploadedMedia.signature?.url || '',
          age: uploadedMedia.age?.url || ''
        }
      };

      console.log('Sending payload to appraisers backend:', {
        session_id: payload.session_id,
        customer_email: payload.customer_email,
        post_id: payload.post_id,
        post_edit_url: payload.post_edit_url,
        images: Object.keys(payload.images).filter(key => payload.images[key])
      });

      await this.appraisersClient.notifySubmission(payload);
    } catch (error) {
      console.error('Failed to notify appraisers backend:', error);
    }
  }
}

module.exports = AppraisersRepository;