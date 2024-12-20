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

    // Prepare metadata with both ACF fields and regular meta fields
    const meta = {
      ...postData.meta,
      _thumbnail_id: '',           // Featured image
      main: '',                    // ACF field
      signature: '',               // ACF field
      age: '',                     // ACF field
      session_id: postData.meta.session_id,           // Regular meta
      _session_id: postData.meta.session_id,          // ACF field prefix
      customer_email: postData.meta.customer_email,   // Regular meta
      _customer_email: postData.meta.customer_email,  // ACF field prefix
      customer_name: postData.meta.customer_name,     // Regular meta
      _customer_name: postData.meta.customer_name     // ACF field prefix
    };

    console.log('Prepared metadata:', JSON.stringify(meta, null, 2));

    const response = await axios.post(
      `${config.WORDPRESS_API_URL}/appraisals`,
      {
        ...postData,
        meta
      },
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
      // The WORDPRESS_API_URL already includes /wp-json/wp/v2
      `${config.WORDPRESS_API_URL}/media`,
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
    console.log('Updating post with media:', JSON.stringify({
      postId, updateData
    }, null, 2));

    // Prepare metadata with both ACF fields and regular meta fields
    const meta = {
      ...updateData.meta,
      _thumbnail_id: updateData.meta.main || '',     // Featured image
      main: updateData.meta.main || '',             // ACF field
      _main: updateData.meta.main || '',            // ACF field prefix
      signature: updateData.meta.signature || '',    // ACF field
      _signature: updateData.meta.signature || '',   // ACF field prefix
      age: updateData.meta.age || '',               // ACF field
      _age: updateData.meta.age || ''               // ACF field prefix
    };

    console.log('Prepared metadata for update:', JSON.stringify(meta, null, 2));

    await axios.patch(
      `${config.WORDPRESS_API_URL}/appraisals/${postId}?acf_format=standard`,
      {
        ...updateData,
        meta
      },
      { headers: getCommonHeaders(config) }
    );

    console.log('Post updated successfully');
  } catch (error) {
    console.error('Error updating post:', {
      url: error.config?.url,
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
  updatePostWithMedia
};