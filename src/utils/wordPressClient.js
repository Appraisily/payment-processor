const axios = require('axios');
const FormData = require('form-data');

async function createInitialPost(postData, config) {
  try {
    const response = await axios.post(
      `${config.WORDPRESS_API_URL}/wp/v2/appraisals`,
      {
        ...postData,
        meta: {
          ...postData.meta,
          _thumbnail_id: '' // Initialize featured image field
        }
      },
      {
        headers: {
          Authorization: `Bearer ${config.WORDPRESS_API_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return {
      id: response.data.id,
      editUrl: `${config.WORDPRESS_ADMIN_URL}/post.php?post=${response.data.id}&action=edit`
    };
  } catch (error) {
    console.error('Error creating WordPress post:', error);
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
          Authorization: `Bearer ${config.WORDPRESS_API_TOKEN}`
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
      `${config.WORDPRESS_API_URL}/wp/v2/appraisals/${postId}?acf_format=standard`,
      {
        ...updateData,
        meta: {
          ...updateData.meta,
          _thumbnail_id: updateData.meta.main || '' // Set main image as featured image
        }
      },
      {
        headers: {
          Authorization: `Bearer ${config.WORDPRESS_API_TOKEN}`,
          'Content-Type': 'application/json'
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