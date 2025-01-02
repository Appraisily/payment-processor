const axios = require('axios');
const FormData = require('form-data');

async function updatePost(postId, data, config) {
  const endpoint = `${config.WORDPRESS_API_URL}/appraisals/${postId}`;
  console.log('WordPress API Request:', {
    endpoint,
    method: 'POST',
    headers: {
      ...getCommonHeaders(config),
      Authorization: '[REDACTED]'
    },
    data: JSON.stringify(data, null, 2)
  });

  const response = await axios.post(
    endpoint,
    data,
    { headers: getCommonHeaders(config) }
  );

  console.log('WordPress API Response:', {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
    data: JSON.stringify(response.data, null, 2)
  });

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
    const endpoint = `${config.WORDPRESS_API_URL}/appraisals`;
    console.log('WordPress Create Post Request:', {
      endpoint,
      method: 'POST',
      data: JSON.stringify(postData, null, 2)
    });

    const response = await axios.post(
      endpoint,
      {
        ...postData,
        status: 'draft'
      },
      { headers: getCommonHeaders(config) }
    );

    console.log('WordPress post created successfully:', JSON.stringify(response.data, null, 2));

    // Update ACF fields with the metadata from postData
    await updatePostAcfFields(response.data.id, postData.meta, config);

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

async function updatePostAcfFields(postId, fields, config) {
  try {
    console.log('WordPress Update ACF Fields Request:', {
      postId,
      fields: JSON.stringify(fields, null, 2)
    });

    const response = await updatePost(postId, {
      meta: {
        session_id: fields.session_id || '',
        customer_email: fields.customer_email || '',
        customer_name: fields.customer_name || '',
        processing_status: fields.processing_status || 'pending',
        main: fields.main || '',
        signature: fields.signature || '',
        age: fields.age || ''
      }
    }, config);

    if (!response || !response.id) {
      throw new Error('Failed to update ACF fields - invalid response');
    }

    console.log('WordPress ACF Fields Update Response:', {
      id: response.id,
      status: 'success'
    });

    return response;
  } catch (error) {
    console.error('Error updating ACF fields:', {
      url: error.config?.url,
      message: error.message,
      response: JSON.stringify(error.response?.data, null, 2),
      status: error.response?.status,
      headers: error.response?.headers
    });
    throw new Error('Failed to update ACF fields');
  }
}

async function updatePostWithMedia(postId, updateData, config) {
  try {
    console.log('Updating post with media:', JSON.stringify({ postId, updateData }, null, 2));
    const response = await updatePost(postId, {
      meta: updateData.meta || {}
    }, config);
    if (!response || !response.id) {
      throw new Error('Failed to update post with media - invalid response');
    }
    console.log('Post updated successfully');
    return response;
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
  updatePostWithMedia,
  updatePostAcfFields
};