const axios = require('axios');
const FormData = require('form-data');

const ENDPOINTS = {
  APPRAISALS: '/appraisals',
  MEDIA: '/media'
};

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

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
    console.log('Creating WordPress post:', {
      title: postData.title,
      status: 'publish'
    });

    const response = await axios.post(
      `${config.WORDPRESS_API_URL}${ENDPOINTS.APPRAISALS}`,
      {
        title: postData.title,
        content: postData.content,
        status: 'publish',
        meta: postData.meta
      },
      { headers: getCommonHeaders(config) }
    );

    if (!response.data?.id) {
      throw new Error('Invalid response: Missing post ID');
    }

    console.log('Post created successfully:', {
      id: response.data.id,
      status: response.data.status
    });

    return {
      id: response.data.id,
      editUrl: `${config.WORDPRESS_ADMIN_URL}/post.php?post=${response.data.id}&action=edit`
    };

  } catch (error) {
    console.error('Post creation failed:', {
      error: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
    throw error;
  }
}

async function uploadMedia(buffer, filename, config) {
  try {
    console.log('Uploading media:', { filename });

    const form = new FormData();
    form.append('file', buffer, {
      filename,
      contentType: 'image/jpeg'
    });

    const response = await axios.post(
      `${config.WORDPRESS_API_URL}${ENDPOINTS.MEDIA}`,
      form,
      {
        headers: {
          Authorization: getAuthHeader(config),
          ...form.getHeaders()
        }
      }
    );

    console.log('Media uploaded:', {
      id: response.data.id,
      url: response.data.source_url
    });

    return {
      id: response.data.id,
      url: response.data.source_url
    };

  } catch (error) {
    console.error('Media upload failed:', {
      error: error.message,
      status: error.response?.status
    });
    throw error;
  }
}

async function updatePost(postId, data, config) {
  try {
    await updatePostStatus(postId, data.status || 'publish', config);
    const acfFields = {};

    // Only include non-empty fields
    if (data.meta?.main) acfFields.main = data.meta.main;
    if (data.meta?.signature) acfFields.signature = data.meta.signature;
    if (data.meta?.age) acfFields.age = data.meta.age;
    if (data.meta?.customer_email) acfFields.customer_email = data.meta.customer_email;
    if (data.meta?.customer_name) acfFields.customer_name = data.meta.customer_name;
    if (data.meta?.session_id) acfFields.session_id = data.meta.session_id;

    // Only update if there are fields to update
    if (Object.keys(acfFields).length > 0) {
      console.log('Updating ACF fields:', acfFields);
    
      const response = await axios.post(
        `${config.WORDPRESS_API_URL}${ENDPOINTS.APPRAISALS}/${postId}`,
        { acf: acfFields },
        { headers: getCommonHeaders(config) }
      );

      console.log('ACF fields updated successfully:', {
        postId,
        updatedFields: Object.keys(acfFields)
      });
    } else {
      console.log('No ACF fields to update');
    }

    return { id: postId, status: 'updated' };

  } catch (error) {
    console.error('Post update failed:', {
      error: error.message,
      postId,
      status: error.response?.status,
      data: error.response?.data
    });
    throw error;
  }
}

async function updatePostStatus(postId, status, config) {
  try {
    console.log('Updating post status:', { postId, status });
    
    const response = await axios.post(
      `${config.WORDPRESS_API_URL}${ENDPOINTS.APPRAISALS}/${postId}`,
      { status },
      { headers: getCommonHeaders(config) }
    );

    console.log('Status updated successfully:', {
      id: postId,
      status: response.data.status
    });

    return response.data;
  } catch (error) {
    console.error('Status update failed:', {
      error: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
    throw error;
  }
}

async function verifyPostInitialization(postId, config) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`Verifying post (attempt ${attempt}/${MAX_RETRIES}):`, { postId });

      const response = await axios.get(
        `${config.WORDPRESS_API_URL}${ENDPOINTS.APPRAISALS}/${postId}`,
        { headers: getCommonHeaders(config) }
      );

      if (response.data?.acf !== undefined) {
        console.log('Post verified:', { postId, attempt });
        return true;
      }

      console.log('Post not ready:', { postId, attempt });
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));

    } catch (error) {
      console.error('Verification failed:', {
        error: error.message,
        attempt,
        postId
      });

      if (attempt === MAX_RETRIES) {
        throw error;
      }

      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
    }
  }

  return false;
}

module.exports = {
  createPost,
  uploadMedia,
  updatePost,
  verifyPostInitialization,
  ENDPOINTS
};