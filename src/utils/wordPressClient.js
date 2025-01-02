const axios = require('axios');
const FormData = require('form-data');

async function inspectEndpoint(config) {
  try {
    console.log('Inspecting WordPress API endpoint...');
    const response = await axios.options(
      `${config.WORDPRESS_API_URL}/appraisals`,
      { headers: getCommonHeaders(config) }
    );
    console.log('API Schema:', {
      routes: response.data?.routes,
      schema: response.data?.schema,
      endpoints: response.data?.endpoints
    });
  } catch (error) {
    console.error('Error inspecting endpoint:', {
      message: error.message,
      response: error.response?.data
    });
  }
}

async function updatePost(postId, data, config) {
  const endpoint = `${config.WORDPRESS_API_URL}/appraisals/${postId}`;
  console.log('WordPress API Request:', {
    endpoint,
    method: 'POST',
    headers: getCommonHeaders(config),
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
    // First inspect the endpoint
    await inspectEndpoint(config);

    console.log('Creating WordPress post:', {
      title: postData.title,
      content: postData.content,
      status: postData.status,
      meta: postData.meta // Log meta to see what we're trying to set
    });

    const endpoint = `${config.WORDPRESS_API_URL}/appraisals`;

    // Try to get current post type schema
    const schemaResponse = await axios.get(
      `${config.WORDPRESS_API_URL}/appraisals/schema`,
      { headers: getCommonHeaders(config) }
    );
    console.log('Post type schema:', schemaResponse.data);

    const response = await axios.post(
      endpoint,
      {
        title: postData.title,
        content: postData.content,
        status: postData.status,
        meta: postData.meta // Try setting meta directly first
      },
      { headers: getCommonHeaders(config) }
    );

    console.log('WordPress post created successfully:', JSON.stringify(response.data, null, 2));

    // Update ACF fields with the metadata from postData
    if (postData.meta) {
      await updatePostAcfFields(response.data.id, postData.meta, config);
    }

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
    console.log('Attempting to update ACF fields:', {
      postId,
      fields: JSON.stringify(fields, null, 2)
    });

    // First try to get current ACF fields
    const currentFields = await axios.get(
      `${config.WORDPRESS_API_URL}/appraisals/${postId}`,
      { headers: getCommonHeaders(config) }
    );
    console.log('Current ACF fields:', currentFields.data.acf);

    // Try updating with both acf and meta
    const updateData = {
      acf: fields,        // Try ACF format
      meta: fields,       // Try meta format
      status: 'publish'
    };

    console.log('Sending update with data:', JSON.stringify(updateData, null, 2));
    const response = await updatePost(postId, updateData, config);
    
    console.log('Update response:', {
      acf: response.acf,
      meta: response.meta
    });

    return response;
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