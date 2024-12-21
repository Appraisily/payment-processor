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
    
    // First create the basic post
    const response = await axios.post(
      `${config.WORDPRESS_API_URL}/appraisals`,
      {
        ...postData,
        status: 'draft'
      },
      { headers: getCommonHeaders(config) }
    );

    console.log('WordPress post created successfully:', JSON.stringify(response.data, null, 2));

    // Then update ACF fields in a separate request
    await updatePostAcfFields(response.data.id, {
      processing_status: 'pending',
      session_id: postData.meta.session_id,
      customer_email: postData.meta.customer_email,
      customer_name: postData.meta.customer_name || '',
      customer_description: postData.meta.customer_description || '',
      submission_date: postData.meta.submission_date,
      main: '',
      signature: '',
      age: ''
    }, config);

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
    console.log('Updating post ACF fields:', JSON.stringify({ postId, fields }, null, 2));
    
    // Update ACF fields through the main endpoint
    await axios.put(
      `${config.WORDPRESS_API_URL}/appraisals/${postId}`,
      {
        acf: fields
      },
      { headers: getCommonHeaders(config) }
    );
    console.log('ACF fields updated successfully');
  } catch (error) {
    console.error('Error updating ACF fields:', {
      url: error.config?.url,
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    throw new Error('Failed to update ACF fields');
  }
}

async function updatePostWithMedia(postId, updateData, config) {
  try {
    console.log('Updating post with media:', JSON.stringify({
      postId, updateData
    }, null, 2));
    
    await axios.put(
      `${config.WORDPRESS_API_URL}/appraisals/${postId}`,
      {
        acf: {
          main: updateData.meta.main || '',
          signature: updateData.meta.signature || '',
          age: updateData.meta.age || '',
          processing_status: updateData.meta.processing_status || '',
          error_message: updateData.meta.error_message || ''
        }
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
  updatePostWithMedia,
  updatePostAcfFields
};