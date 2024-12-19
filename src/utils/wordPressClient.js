const axios = require('axios');
const FormData = require('form-data');

function getAuthHeader(config) {
  const credentials = Buffer.from(`${config.WORDPRESS_USERNAME}:${config.WORDPRESS_APP_PASSWORD}`).toString('base64');
  return `Basic ${credentials}`;
}

function getCommonHeaders(config) {
  return {
    Authorization: getAuthHeader(config),
    'Content-Type': 'application/json',
    'User-Agent': 'Appraisily-Payment-Processor/1.0',
    'X-Requested-With': 'XMLHttpRequest',
    Origin: 'https://payment-processor-856401495068.us-central1.run.app',
    Referer: 'https://payment-processor-856401495068.us-central1.run.app'
  };
}
async function createInitialPost(postData, config) {
  try {
    console.log('Creating WordPress post with data:', JSON.stringify(postData, null, 2));

    const response = await axios.post(
      `${config.WORDPRESS_API_URL}/appraisals`,
      {
        ...postData,
        meta: {
          ...postData.meta,
          _thumbnail_id: '' // Initialize featured image field
        }
      },
      {
        headers: getCommonHeaders(config)
      }
    );

    console.log('WordPress post creation response:', JSON.stringify(response.data, null, 2));

    return {
      id: response.data.id,
      editUrl: `${config.WORDPRESS_ADMIN_URL}/post.php?post=${response.data.id}&action=edit`
    };
  } catch (error) {
    console.error('Error creating WordPress post:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      config: {
        url: error.config?.url,
        method: error.config?.method,
        headers: error.config?.headers
      }
    });
    throw new Error('Failed to create WordPress post');
  }
}

async function uploadMedia(buffer, filename, config) {
  try {
    const form = new FormData();
    form.append('file', buffer, {
      filename,
      contentType: 'image/jpeg'
    });

    const response = await axios.post(
      `${config.WORDPRESS_API_URL}/wp/v2/media`,
      form,
      {
        headers: {
          ...form.getHeaders(),
          ...getCommonHeaders(config),
          'Content-Type': undefined // Let form-data set this
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

async function updatePostWithMedia(postId, updateData, config) {
  try {
    await axios.post(
      `${config.WORDPRESS_API_URL}/appraisals/${postId}?acf_format=standard`,
      {
        ...updateData,
        meta: {
          ...updateData.meta,
          _thumbnail_id: updateData.meta.main || '' // Set main image as featured image
        }
      },
      {
        headers: getCommonHeaders(config)
      }
    );
  } catch (error) {
    console.error('Error updating post:', error);
    throw new Error('Failed to update post');
  }
}

module.exports = {
  createInitialPost,
  uploadMedia,
  updatePostWithMedia
};