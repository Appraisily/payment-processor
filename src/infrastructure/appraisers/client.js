const axios = require('axios');
const { logError } = require('../../utils/error/logger');

class AppraisersBackendClient {
  constructor(config) {
    this.config = config;
    this.baseUrl = config.APPRAISERS_BACKEND_URL || 'https://appraisers-backend-856401495068.us-central1.run.app';
  }

  async notifySubmission(data) {
    try {
      console.log('Notifying appraisers backend:', {
        session_id: data.session_id,
        wordpress_url: data.wordpress_url
      });

      const response = await axios.post(
        `${this.baseUrl}/api/update-pending-appraisal`,
        {
          session_id: data.session_id,
          customer_email: data.customer_email,
          customer_name: data.customer_name || '',
          description: data.description || '',
          payment_id: data.payment_id || '',
          wordpress_url: data.wordpress_url,
          images: {
            main: data.images.main?.url || '',
            age: data.images.age?.url || '',
            signature: data.images.signature?.url || ''
          }
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-shared-secret': this.config.SHARED_SECRET
          },
          timeout: 10000 // 10 second timeout
        }
      );

      console.log('Successfully notified appraisers backend');
      return response.data;
    } catch (error) {
      console.error('Error notifying appraisers backend:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });

      await logError(this.config, {
        severity: 'Warning',
        scriptName: 'AppraisersBackendClient',
        errorCode: 'BACKEND_NOTIFICATION_ERROR',
        errorMessage: error.message,
        stackTrace: error.stack,
        userId: data.customer_email,
        additionalContext: JSON.stringify({
          session_id: data.session_id,
          response: error.response?.data
        })
      });

      throw error;
    }
  }
}

module.exports = AppraisersBackendClient;