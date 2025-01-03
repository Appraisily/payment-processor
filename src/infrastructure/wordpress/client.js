const axios = require('axios');
const FormData = require('form-data');

// IMPORTANT NOTE: WordPress API URL handling
// The WORDPRESS_API_URL from config includes '/wp-json/wp/v2'
// ✓ Correct: config.WORDPRESS_API_URL + '/appraisals'
// ✗ Wrong: config.WORDPRESS_API_URL + '/wp/v2/appraisals'
// This prevents the common error of duplicate 'wp/v2' in the path

const ENDPOINTS = {
  APPRAISALS: '/appraisals',
  MEDIA: '/media'
};

async function getOutboundIP() {
  try {
    const response = await axios.get('https://api.ipify.org?format=json');
    return response.data.ip;
  } catch (error) {
    console.error('Error getting outbound IP:', error);
    return 'Unknown';
  }
}

function getAuthHeader(config) {
  const credentials = Buffer.from(`${config.WORDPRESS_USERNAME}:${config.WORDPRESS_APP_PASSWORD}`).toString('base64');
  return `Basic ${credentials}`;
}

function getCommonHeaders(config) {
  return {
    Authorization: getAuthHeader(config),
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };
}

async function createPost(postData, config) {
  try {
    const outboundIP = await getOutboundIP();
    const endpoint = `${config.WORDPRESS_API_URL}${ENDPOINTS.APPRAISALS}`;
    
    console.log('Starting WordPress post creation:', {
      outboundIP,
      title: postData.title,
      url: endpoint,
      meta: postData.meta,
      content_length: postData.content.length,
      status: postData.status
    });

    console.log('WordPress request payload:', {
      title: postData.title,
      status: postData.status,
      content: postData.content
    });

    const response = await axios.post(
      endpoint,
      {
        title: postData.title,
        content: postData.content,
        status: postData.status
      },
      { headers: getCommonHeaders(config) }
    );

    // Validate response data
    if (!response.data || !response.data.id) {
      throw new Error('Invalid response from WordPress: Missing post ID');
    }

    const postId = response.data.id;
    
    console.log('WordPress post created successfully:', {
      post_id: response.data.id,
      status: response.data.status,
      type: response.data.type,
      link: response.data.link,
      modified: response.data.modified
    });

    return {
      id: postId,
      editUrl: `${config.WORDPRESS_ADMIN_URL}/post.php?post=${postId}&action=edit`
    };
  } catch (error) {
    console.error('Error creating WordPress post:', {
      error_name: error.name,
      error_message: error.message,
      status: error.response?.status,
      response_data: error.response?.data,
      request_url: error.config?.url,
      headers: {
        ...getCommonHeaders(config),
        Authorization: '***' // Hide sensitive data
      }
    });

    // Throw specific error messages based on response
    if (error.response?.status === 404) {
      throw new Error('WordPress API endpoint not found. Check API URL configuration.');
    } else if (error.response?.status === 401) {
      throw new Error('WordPress authentication failed. Check credentials.');
    } else {
      throw new Error(`Failed to create WordPress post: ${error.message}`);
    }
    throw new Error('Failed to create WordPress post');
  }
}

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

async function updatePost(postId, data, config) {
  try {
    const outboundIP = await getOutboundIP();
    console.log('Updating WordPress post:', {
      outboundIP,
      postId,
      url: `${config.WORDPRESS_API_URL}${ENDPOINTS.APPRAISALS}/${postId}`,
      fields: Object.keys(data.meta)
    });
    
    // Combine all ACF fields
    const acfData = {
      acf: {
        // Media fields
        main: data.meta.main || '',
        signature: data.meta.signature || '',
        age: data.meta.age || '',
        // Customer fields
        customer_name: data.meta.customer_name || '',
        customer_email: data.meta.customer_email || '',
        session_id: data.meta.session_id || ''
      }
    };

    const response = await axios.post(
      `${config.WORDPRESS_API_URL}${ENDPOINTS.APPRAISALS}/${postId}`,
      acfData,
      { headers: getCommonHeaders(config) }
    );

    console.log('Post updated successfully:', {
      id: postId,
      acf: acfData.acf
    });

    return response.data;
  } catch (error) {
    console.error('Error updating post:', error);
    console.error('Update post error details:', {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
      postId,
      url: `${config.WORDPRESS_API_URL}${ENDPOINTS.APPRAISALS}/${postId}`
    });
    throw new Error('Failed to update post');
  }
}

module.exports = {
  createPost,
  uploadMedia,
  updatePost,
  getOutboundIP
};