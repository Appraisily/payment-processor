const axios = require('axios');
const FormData = require('form-data');
const { getOutboundIP, getAuthHeader } = require('./auth');
const { ENDPOINTS } = require('./constants');

async function uploadMedia(buffer, filename, config) {
  try {
    const outboundIP = await getOutboundIP();
    console.log('Starting WordPress media upload:', {
      outboundIP,
      filename,
      url: `${config.WORDPRESS_API_URL}${ENDPOINTS.MEDIA}`,
      size: buffer.length,
      content_type: 'image/jpeg'
    });

    const form = new FormData();
    console.log('Creating form data for media upload');
    form.append('file', buffer, {
      filename: filename,
      contentType: 'image/jpeg'
    });

    console.log('Media upload request configuration:', {
      endpoint: `${config.WORDPRESS_API_URL}${ENDPOINTS.MEDIA}`,
      filename,
      content_length: buffer.length,
      form_headers: Object.keys(form.getHeaders())
    });

    const response = await axios.post(
      `${config.WORDPRESS_API_URL}${ENDPOINTS.MEDIA}`,
      form,
      {
        headers: {
          Authorization: getAuthHeader(config),
          ...form.getHeaders()
        }
      }
    );

    console.log('WordPress media upload successful:', {
      id: response.data.id,
      url: response.data.source_url,
      title: response.data.title?.rendered,
      mime_type: response.data.mime_type,
      media_type: response.data.media_type,
      alt_text: response.data.alt_text,
      status: response.data.status
    });

    return {
      id: response.data.id,
      url: response.data.source_url
    };
  } catch (error) {
    console.error('WordPress media upload error:', {
      error_name: error.name,
      error_message: error.message,
      status: error.response?.status,
      response_data: error.response?.data,
      headers_sent: error.config?.headers,
      request_url: error.config?.url,
      filename,
      buffer_size: buffer.length
    });

    if (error.response?.status === 413) {
      console.error('File size too large for WordPress server');
    } else if (error.response?.status === 404) {
      console.error('WordPress media endpoint not found - check API URL');
    }

    throw new Error('Failed to upload media');
  }
}

module.exports = {
  uploadMedia
};