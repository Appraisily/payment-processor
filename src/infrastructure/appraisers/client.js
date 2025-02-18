const axios = require('axios');
const { logError } = require('../../utils/error/logger');

class AppraisersBackendClient {
  constructor(config) {
    this.config = config;
  }

  async notifySubmission(data) {
    try {
      console.log('Notifying appraisers backend:', {
        session_id: data.session_id,
        post_edit_url: data.post_edit_url,
        images: {
          main: data.images.main || '',
          signature: data.images.signature || '',
          age: data.images.age || ''
        }
      });

      const response = await axios.post(
        'https://appraisers-backend-856401495068.us-central1.run.app/api/update-pending-appraisal',
        {
          session_id: data.session_id,
          customer_email: data.customer_email,
          post_id: data.post_id,
          post_edit_url: data.post_edit_url,
          description: data.description || '',
          images: {
            main: data.images.main || '',
            age: data.images.age || '',
            signature: data.images.signature || ''
          }
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-shared-secret': this.config.SHARED_SECRET
          },
          timeout: 10000
        }
      );

      console.log('Successfully notified appraisers backend:', {
        status: response.status,
        data: response.data,
        post_id: data.post_id,
        post_edit_url: data.post_edit_url
      });

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