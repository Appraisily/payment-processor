const AppraisersBackendClient = require('../../../infrastructure/appraisers/client');

class AppraisersRepository {
  constructor(config) {
    this.config = config;
    this.appraisersClient = new AppraisersBackendClient(config);
  }

  async notifySubmission(submission, wordpressUrl, uploadedMedia) {
    try {
      // Ensure all required fields are present with fallbacks
      const payload = {
        session_id: submission.session_id,
        customer_email: submission.customer_email || '',
        customer_name: submission.customer_name || '',
        description: submission.description || '',
        payment_id: submission.payment_id || '',
        wordpress_url: wordpressUrl || '',
        images: {
          main: uploadedMedia.main?.url || '',
          signature: uploadedMedia.signature?.url || '',
          age: uploadedMedia.age?.url || ''
        }
      };

      console.log('Sending payload to appraisers backend:', {
        session_id: payload.session_id,
        customer_email: payload.customer_email,
        has_description: !!payload.description,
        wordpress_url: payload.wordpress_url,
        images: Object.keys(payload.images).filter(key => payload.images[key])
      });

      await this.appraisersClient.notifySubmission({
        ...payload
      });
    } catch (error) {
      console.error('Failed to notify appraisers backend:', error);
    }
  }
}

module.exports = AppraisersRepository;