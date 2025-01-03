const axios = require('axios');
const FormData = require('form-data');
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

const ENDPOINTS = {
  APPRAISALS: '/appraisals',
  MEDIA: '/media'
};

async function verifyPostInitialization(postId, config) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`Verifying post initialization (attempt ${attempt}/${MAX_RETRIES}):`, {
        post_id: postId
      });

      const response = await axios.get(
        `${config.WORDPRESS_API_URL}${ENDPOINTS.APPRAISALS}/${postId}`,
        { headers: getCommonHeaders(config) }
      );

      // Check if ACF fields are initialized
      if (response.data && response.data.acf !== undefined) {
        console.log('Post initialization verified:', {
          post_id: postId,
          acf_initialized: true,
          attempt
        });
        return true;
      }

      console.log('Post not fully initialized yet:', {
        post_id: postId,
        attempt,
        has_acf: response.data?.acf !== undefined
      });

      // Wait before next attempt
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
    } catch (error) {
      console.error('Error verifying post initialization:', {
        post_id: postId,
        attempt,
        error: error.message
      });
      
      if (attempt === MAX_RETRIES) {
        throw new Error('Failed to verify post initialization');
      }
      
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
    }
  }
  
  return false;
}

// Export ENDPOINTS for use in other modules
module.exports = {
  createPost,
  uploadMedia,
  updatePost,
  verifyPostInitialization,
  ENDPOINTS
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
      status: 'publish'
    });

    // First create the post without ACF fields
    const initialResponse = await axios.post(
      endpoint,
      {
        title: postData.title,
        content: postData.content,
        status: 'publish'
      },
      { headers: getCommonHeaders(config) }
    );

    // Validate initial response
    if (!initialResponse.data || !initialResponse.data.id) {
      throw new Error('Invalid response from WordPress: Missing post ID');
    }

    const postId = initialResponse.data.id;
    
    console.log('WordPress post created successfully:', {
      post_id: postId,
      status: initialResponse.data.status,
      type: initialResponse.data.type,
      link: initialResponse.data.link,
      modified: initialResponse.data.modified
    });

    // Wait for post initialization
    await verifyPostInitialization(postId, config);
    
    // Now update with ACF fields
    if (postData.meta) {
      console.log('Updating post with ACF fields:', {
        post_id: postId,
        meta: postData.meta
      });

      await updatePost(postId, {
        meta: postData.meta,
        status: 'publish'
      }, config);
    }

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
    const endpoint = `${config.WORDPRESS_API_URL}${ENDPOINTS.APPRAISALS}/${postId}`;

    console.log('Updating WordPress post:', {
      outboundIP,
      postId,
      url: endpoint,
      acf: {
        main: data.meta.main || '',
        signature: data.meta.signature || '',
        age: data.meta.age || '',
        customer_email: data.meta.customer_email || '',
        customer_name: data.meta.customer_name || '',
        session_id: data.meta.session_id || ''
      }
    });
    
    const postData = {
      status: data.status || 'publish',
      acf: {
        main: data.meta.main || '',
        signature: data.meta.signature || '',
        age: data.meta.age || '',
        customer_email: data.meta.customer_email || '',
        customer_name: data.meta.customer_name || '',
        session_id: data.meta.session_id || ''
      }
    };

    const response = await axios.post(
      endpoint,
      postData,
      { headers: getCommonHeaders(config) }
    );

    console.log('Post updated successfully:', {
      id: postId,
      acf: postData.acf,
      status: postData.status
    });

    return response.data;
  } catch (error) {
    console.error('Error updating post:', error);
    console.error('Error updating post - Full response:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      headers: error.response?.headers,
      message: error.message,
    });
    throw new Error('Failed to update post');
  }
}