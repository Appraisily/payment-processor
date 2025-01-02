const axios = require('axios');
const FormData = require('form-data');

async function updatePost(postId, data, config) {
  const endpoint = `${config.WORDPRESS_API_URL}/appraisals/${postId}`;
  console.log('WordPress API Request to update post:', {
    endpoint,
    method: 'POST',
    acf_fields: data.acf ? Object.keys(data.acf) : [],
    acf_values: data.acf
  });

  const response = await axios.post(
    endpoint,
    data,
    { headers: getCommonHeaders(config) }
  );

  console.log('WordPress API Response:', {
    status: response.status,
    statusText: response.statusText,
    updated_fields: response.data.acf ? Object.keys(response.data.acf) : [],
    acf_values: response.data.acf
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
    console.log('Creating WordPress post with data:', {
      title: postData.title,
      content: postData.content,
      status: postData.status,
      acf: postData.meta
    });

    const endpoint = `${config.WORDPRESS_API_URL}/appraisals`;

    const response = await axios.post(
      endpoint,
      {
        title: postData.title,
        content: postData.content,
        status: postData.status,
        acf: postData.meta
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
    console.log('Updating ACF fields:', {
      postId,
      acf: fields
    });

    const response = await updatePost(postId, {
      acf: fields,
      status: 'publish'
    }, config);
    
    console.log('ACF fields updated successfully');

    return response;
  } catch (error) {
    console.error('Error updating ACF fields:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      headers: error.response?.headers
    });
    throw new Error('Failed to update ACF fields');
  }
}

async function updatePostWithMedia(postId, updateData, config) {
  try {
    console.log('Updating post with media:', {
      postId,
      acf: updateData.meta
    });
    
    const response = await updatePost(postId, {
      acf: updateData.meta || {},
      status: 'publish'
    }, config);

    console.log('Post updated successfully');
    return response;
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