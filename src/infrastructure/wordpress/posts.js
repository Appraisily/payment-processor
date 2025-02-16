const axios = require('axios');
const { getOutboundIP, getCommonHeaders } = require('./auth');
const { ENDPOINTS } = require('./constants');

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

    if (error.response?.status === 404) {
      throw new Error('WordPress API endpoint not found. Check API URL configuration.');
    } else if (error.response?.status === 401) {
      throw new Error('WordPress authentication failed. Check credentials.');
    } else {
      throw new Error(`Failed to create WordPress post: ${error.message}`);
    }
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
      status: data.status || 'publish',
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

module.exports = {
  createPost,
  updatePost
};