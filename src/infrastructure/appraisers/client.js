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
        customer_email: data.customer_email,
        post_id: data.wordpress_url.match(/post=(\d+)/)?.[1] || '',
        post_edit_url: data.wordpress_url,
        images: {
          main: data.images.main || '',
          signature: data.images.signature || '',
          age: data.images.age || ''
        },
        description: data.description || ''
      });

      // Extract post ID from WordPress URL
      const postId = data.wordpress_url.match(/post=(\d+)/)?.[1];
      if (!postId) {
        throw new Error('Could not extract post ID from WordPress URL');
      }

      // Validate required fields
      if (!data.session_id || !data.customer_email || !data.wordpress_url || !data.images.main) {
        throw new Error('Missing required fields for appraisers backend notification');
      }

      const response = await axios.post(
        this.config.APPRAISERS_BACKEND_URL,
        {
          session_id: data.session_id,
          customer_email: data.customer_email,
          post_id: postId,
          post_edit_url: data.wordpress_url,
          images: {
            main: data.images.main || '',
            age: data.images.age || '',
            signature: data.images.signature || ''
          },
          description: data.description || ''
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
        sentFields: {
          session_id: !!data.session_id,
          customer_email: !!data.customer_email,
          post_id: !!postId,
          post_edit_url: !!data.wordpress_url,
          main_image: !!data.images.main
        }
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