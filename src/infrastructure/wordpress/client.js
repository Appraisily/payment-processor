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
    console.log('Updating post:', { postId, fields: Object.keys(data) });

    const response = await axios.post(
      `${config.WORDPRESS_API_URL}${ENDPOINTS.APPRAISALS}/${postId}`,
      {
        status: data.status || 'publish',
        acf: {
          main: data.meta?.main || '',
          signature: data.meta?.signature || '',
          age: data.meta?.age || '',
          customer_email: data.meta?.customer_email || '',
          customer_name: data.meta?.customer_name || '',
          session_id: data.meta?.session_id || ''
        }
      },
      { headers: getCommonHeaders(config) }
    );

    console.log('Post updated successfully:', {
      id: postId,
      status: response.data.status
    });

    return response.data;

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