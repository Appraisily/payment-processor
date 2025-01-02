const axios = require('axios');
const FormData = require('form-data');

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
    console.log('Cloud Run service outbound IP:', outboundIP);

    const response = await axios.post(
      `${config.WORDPRESS_API_URL}/posts`,
      {
        title: postData.title,
        content: postData.content,
        type: postData.type,
        status: postData.status,
        meta: postData.meta
      },
      { headers: getCommonHeaders(config) }
    );

    return {
      id: response.data.id,
      editUrl: `${config.WORDPRESS_ADMIN_URL}/post.php?post=${response.data.id}&action=edit`
    };
  } catch (error) {
    console.error('Error creating WordPress post:', error);
    throw new Error('Failed to create WordPress post');
  }
}

async function uploadMedia(buffer, filename, config) {
  try {
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
    console.error('Error uploading media:', error);
    throw new Error('Failed to upload media');
  }
}

async function updatePost(postId, data, config) {
  try {
    const outboundIP = await getOutboundIP();
    console.log('Cloud Run service outbound IP:', outboundIP);

    const response = await axios.post(
      `${config.WORDPRESS_API_URL}/posts/${postId}`,
      data,
      { headers: getCommonHeaders(config) }
    );

    return response.data;
  } catch (error) {
    console.error('Error updating post:', error);
    throw new Error('Failed to update post');
  }
}

module.exports = {
  createPost,
  uploadMedia,
  updatePost,
  getOutboundIP
};