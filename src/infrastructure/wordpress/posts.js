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
      url: endpoint,
      meta: data.meta ? Object.keys(data.meta) : []
    });
    
    // Build ACF fields object, excluding null/empty values
    const acfFields = {};
    
    if (data.meta) {
      // Handle media fields - only include if they have valid IDs
      if (data.meta.main && data.meta.main !== '0') acfFields.main = data.meta.main;
      if (data.meta.signature && data.meta.signature !== '0') acfFields.signature = data.meta.signature;
      if (data.meta.age && data.meta.age !== '0') acfFields.age = data.meta.age;
      
      // Handle customer info fields - only include if they have values
      if (data.meta.customer_name) acfFields.customer_name = data.meta.customer_name;
      if (data.meta.customer_email) acfFields.customer_email = data.meta.customer_email;
      if (data.meta.session_id) acfFields.session_id = data.meta.session_id;
    }
    
    // Only include ACF in post data if we have fields to update
    const postData = {
      status: data.status || 'publish'
    };

    if (Object.keys(acfFields).length > 0) {
      postData.acf = acfFields;
      console.log('Updating post with ACF fields:', acfFields);
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