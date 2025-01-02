const axios = require('axios');
const FormData = require('form-data');
const dns = require('dns').promises;

async function getOutboundIP() {
  try {
    // Make a request to a service that returns the IP
    const response = await axios.get('https://api.ipify.org?format=json');
    return response.data.ip;
  } catch (error) {
    console.error('Error getting outbound IP:', error);
    return 'Unknown';
  }
}

async function updatePost(postId, data, config) {
  const endpoint = `${config.WORDPRESS_API_URL}/posts/${postId}`;
  
  // Get the outbound IP before making the WordPress request
  const outboundIP = await getOutboundIP();
  console.log('Cloud Run service outbound IP:', outboundIP);
  
  console.log('Updating post:', postId, 'with data:', JSON.stringify(data, null, 2));

  const response = await axios.post(
    endpoint,
    data,
    { headers: getCommonHeaders(config) }
  );

  return response.data;
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

async function createInitialPost(postData, config) {
  try {
    const endpoint = `${config.WORDPRESS_API_URL}/posts`;
    
    // Get the outbound IP before making the WordPress request
    const outboundIP = await getOutboundIP();
    console.log('Cloud Run service outbound IP:', outboundIP);

    // Create post with all fields including ACF
    const data = {
      title: postData.title,
      content: postData.content,
      type: 'appraisals',
      status: postData.status,
      acf: postData.meta // Put meta fields in acf object
    };

    console.log('Creating post with data:', JSON.stringify(data, null, 2));

    const response = await axios.post(
      endpoint,
      data,
      { headers: getCommonHeaders(config) }
    );

    console.log('WordPress post created successfully:', JSON.stringify(response.data, null, 2));

    return {
      id: response.data.id,
      editUrl: `${config.WORDPRESS_ADMIN_URL}/post.php?post=${response.data.id}&action=edit`
    };
  } catch (error) {
    console.error('Error creating WordPress post:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    throw new Error('Failed to create WordPress post');
  }
}

async function uploadMedia(buffer, filename, config) {
  try {
    // Get the outbound IP before making the WordPress request
    const outboundIP = await getOutboundIP();
    console.log('Cloud Run service outbound IP:', outboundIP);
    
    const form = new FormData();
    form.append('file', buffer, {
      filename,
      contentType: 'image/jpeg'
    });

    const response = await axios.post(
      `${config.WORDPRESS_API_URL}/media`,
      form,
      {
        headers: {
          ...form.getHeaders(),
          Authorization: getAuthHeader(config)
        }
      }
    );

    return {
      id: response.data.id,
      url: response.data.source_url
    };
  } catch (error) {
    console.error('Error uploading media:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    throw new Error('Failed to upload media');
  }
}

async function updatePostAcfFields(postId, fields, config) {
  try {
    return await updatePost(postId, {
      acf: fields,
      status: 'publish'
    }, config);
  } catch (error) {
    console.error('Error updating ACF fields:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    throw new Error('Failed to update ACF fields');
  }
}

async function updatePostWithMedia(postId, updateData, config) {
  try {
    return await updatePost(postId, {
      acf: updateData.meta || {},
      status: 'publish'
    }, config);
  } catch (error) {
    console.error('Error updating post:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    throw new Error('Failed to update post');
  }
}

module.exports = {
  createInitialPost,
  uploadMedia,
  updatePostWithMedia,
  updatePostAcfFields
};