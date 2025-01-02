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
      `${config.WORDPRESS_API_URL}/wp/v2/appraisals`,
      {
        title: postData.title,
        content: postData.content,
        status: postData.status,
        meta: postData.meta
      },
      { headers: getCommonHeaders(config) }
    );
    
    console.log('WordPress post created successfully:', response.data.id);

    return {
      id: response.data.id,
      editUrl: `${config.WORDPRESS_ADMIN_URL}/post.php?post=${response.data.id}&action=edit`
    };
  } catch (error) {
    console.error('Error creating WordPress post:', {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    });
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
      contentType: 'image/jpeg',
      knownLength: buffer.length
    });

    const response = await axios.post(
      `${config.WORDPRESS_API_URL}/wp/v2/media`,
      form,
      {
        headers: {
          ...form.getHeaders(),
          Authorization: getAuthHeader(config),
          'Content-Length': buffer.length
        }
      }
    );

    console.log('Media uploaded successfully:', {
      id: response.data.id,
      url: response.data.source_url
    });

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
    
    // Combine all ACF fields
    const acfData = {
      acf: {
        // Media fields
        main_image: data.meta.main || '',
        signature_image: data.meta.signature || '',
        age_image: data.meta.age || '',
        // Customer fields
        customer_name: data.meta.customer_name || '',
        customer_email: data.meta.customer_email || '',
        session_id: data.meta.session_id || ''
      }
    };

    const response = await axios.post(
      `${config.WORDPRESS_API_URL}/wp/v2/appraisals/${postId}`,
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
    throw new Error('Failed to update post');
  }
}

module.exports = {
  createPost,
  uploadMedia,
  updatePost,
  getOutboundIP
};