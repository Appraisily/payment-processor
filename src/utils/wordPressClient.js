const axios = require('axios');
const FormData = require('form-data');

function getAuthHeader(config) {
  const credentials = Buffer.from(`${config.WORDPRESS_USERNAME}:${config.WORDPRESS_APP_PASSWORD}`).toString('base64');
  return `Basic ${credentials}`;
}

function getCommonHeaders(config) {
  return {
    'Content-Type': 'application/json',
    'User-Agent': 'Appraisily-Payment-Processor/1.0',
    'X-Requested-With': 'XMLHttpRequest',
    Origin: 'https://payment-processor-856401495068.us-central1.run.app',
    Referer: 'https://payment-processor-856401495068.us-central1.run.app'
  };
}

async function createInitialPost(postData, config) {
  try {
    console.log('Creating WordPress post...');

    // Prepare metadata with both ACF fields and regular meta fields
    const meta = {
      ...postData.meta,
      _thumbnail_id: '',  // Featured image
      // ACF fields
      main: '',
      signature: '',
      age: '',
      // Regular meta fields
      _session_id: postData.meta.session_id,
      session_id: postData.meta.session_id,
      _customer_email: postData.meta.customer_email,
      customer_email: postData.meta.customer_email,
      _customer_name: postData.meta.customer_name,
      customer_name: postData.meta.customer_name
    };

    const response = await axios.post(
      `${config.WORDPRESS_API_URL}/appraisals`,
      {
        ...postData,
        meta
      },
      {
        headers: {
          ...getCommonHeaders(config),
          Authorization: getAuthHeader(config)
        }
      }
    );

    console.log('WordPress post created successfully');

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
    console.log('Uploading media to WordPress:', filename);

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
          Authorization: getAuthHeader(config)
        }
      }
    );

    console.log('Media upload successful:', response.data.id);

    return {
      id: response.data.id,
      url: response.data.source_url
    };
  } catch (error) {
    console.error('Error uploading media:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      endpoint: error.config?.url
    });
    throw new Error('Failed to upload media');
  }
}

async function updatePostWithMedia(postId, updateData, config) {
  try {
    console.log('Updating post with media:', {
      postId,
      meta: updateData.meta
    });

    await axios.patch(
      `${config.WORDPRESS_API_URL}/appraisals/${postId}?acf_format=standard`,
      {
        ...updateData,
        meta: {
          ...updateData.meta,
          _thumbnail_id: updateData.meta.main || '', // Set main image as featured image
          // ACF fields
          main: updateData.meta.main || '',
          signature: updateData.meta.signature || '',
          age: updateData.meta.age || ''
        }
      },
      {
        headers: {
          ...getCommonHeaders(config),
          Authorization: getAuthHeader(config)
        }
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