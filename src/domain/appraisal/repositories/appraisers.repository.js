const AppraisersBackendClient = require('../../../infrastructure/appraisers/client');

class AppraisersRepository {
  constructor(config) {
    this.config = config;
    this.appraisersClient = new AppraisersBackendClient(config);
  }

  async notifySubmission(submission, wordpressUrl, uploadedMedia) {
    try {
      await this.appraisersClient.notifySubmission({
        session_id: submission.session_id,
        customer_email: submission.customer_email,
        customer_name: submission.customer_name,
        description: submission.description,
        wordpress_url: wordpressUrl,
        images: {
          main: uploadedMedia.main?.url || '',
          signature: uploadedMedia.signature?.url || '',
          age: uploadedMedia.age?.url || ''
        },
        payment_id: submission.payment_id
      });
    } catch (error) {
      console.error('Failed to notify appraisers backend:', error);
    }
  }
}

module.exports = AppraisersRepository;