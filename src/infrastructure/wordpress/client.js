const axios = require('axios');
const FormData = require('form-data');

const ENDPOINTS = {
  APPRAISALS: '/appraisals',
  MEDIA: '/media'
};

// Export ENDPOINTS for use in other modules
module.exports = {
  createPost,
  uploadMedia,
  updatePost,
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
    const endpoint = `${config.WORDPRESS_API_URL}${ENDPOINTS.APPRAISALS}/${postId}`;
    
    console.log('Updating WordPress post:', {
      outboundIP,
      postId,
      url: endpoint,
      fields: Object.keys(data.meta)
    });
    
    const postData = {
      status: data.status || 'draft',
      acf: data.meta ? {
        value: data.meta.value || 0,
        main: data.meta.main || null,
        signature: data.meta.signature || null,
        age: data.meta.age || null,
        similar: data.meta.similar || null,
        customer_email: data.meta.customer_email || '',
        secondary_email: data.meta.secondary_email || '',
        customer_name: data.meta.customer_name || '',
        customer_address: data.meta.customer_address || '',
        session_id: data.meta.session_id || '',
        googlevision: data.meta.googlevision || null,
        _gallery_populated: data.meta._gallery_populated || 'false',
        table: data.meta.table || '',
        ad_copy: data.meta.ad_copy || '',
        age_text: data.meta.age_text || '',
        age1: data.meta.age1 || '',
        condition: data.meta.condition || '',
        signature1: data.meta.signature1 || '',
        signature2: data.meta.signature2 || '',
        style: data.meta.style || '',
        valuation_method: data.meta.valuation_method || '',
        authorship: data.meta.authorship || '',
        conclusion1: data.meta.conclusion1 || '',
        conclusion2: data.meta.conclusion2 || '',
        test: data.meta.test || '',
        pdflink: data.meta.pdflink || '',
        doclink: data.meta.doclink || '',
        glossary: data.meta.glossary || '',
        shortcodes_inserted: data.meta.shortcodes_inserted || false,
        appraisaltype: data.meta.appraisaltype || ''
      } : {}
    };

    const response = await axios.post(
      endpoint,
      postData,
      { headers: getCommonHeaders(config) }
    );

    console.log('Post updated successfully:', {
      id: postId,
      meta: postData.meta,
      status: postData.status
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