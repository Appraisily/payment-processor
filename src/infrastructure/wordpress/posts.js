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
      content_length: postData.content.length,
      status: postData.status
    });

    const payload = {
      title: postData.title,
      content: postData.content,
      status: postData.status,
      type: 'appraisals'
    };

    console.log('WordPress request payload:', payload);

    const response = await axios.post(
      endpoint,
      payload,
      { headers: getCommonHeaders(config) }
    );

    // Validate response data
    if (!response?.data?.id) {
      console.error('WordPress response:', response?.data);
      throw new Error(`Invalid response from WordPress: ${JSON.stringify(response?.data)}`);
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
      url: endpoint
    });
    
    // Prepare post data with required fields
    const postData = {
      status: data.status || 'publish'
    }

    // Handle ACF fields
    if (data.meta) {
      postData.acf = {
        main: data.meta.main || '0',
        signature: data.meta.signature || '0',
        age: data.meta.age || '0',
        customer_name: data.meta.customer_name || '',
        customer_email: data.meta.customer_email || '',
        session_id: data.meta.session_id || ''
      };

      console.log('Updating post with ACF fields:', postData.acf);
    }

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