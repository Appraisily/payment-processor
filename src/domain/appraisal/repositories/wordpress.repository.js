const { createPost, updatePost } = require('../../../infrastructure/wordpress/posts');
const { uploadMedia } = require('../../../infrastructure/wordpress/media');
const { logError } = require('../../../utils/error/logger');

class WordPressRepository {
  constructor(config) {
    this.config = config;
  }

  async createPost(submission) {
    try {
      const post = await createPost({
        title: `Art Appraisal Request - ${submission.session_id}`,
        content: ' ',
        status: 'draft',
        type: 'appraisals'
      }, this.config);

      await this.updatePostMetadata(post.id, submission);
      return post;
    } catch (error) {
      await this.handleError(error, submission.session_id);
      return null;
    }
  }

  async updatePostMetadata(postId, submission) {
    try {
      await updatePost(postId, {
        status: 'draft',
        meta: {
          session_id: submission.session_id,
          customer_email: submission.customer_email,
          customer_name: submission.customer_name,
          main: '0',
          signature: '0',
          age: '0'
        }
      }, this.config);
    } catch (error) {
      console.error('Failed to update post metadata:', error);
    }
  }

  async uploadMedia(processedImages) {
    const uploadedMedia = {};
    for (const [key, buffer] of Object.entries(processedImages)) {
      if (!buffer?.[0]) continue;
      uploadedMedia[key] = await uploadMedia(
        buffer[0].buffer,
        `${key}-${Date.now()}.jpg`,
        this.config
      );
    }
    return uploadedMedia;
  }

  async updatePostWithMedia(postId, data) {
    const meta = {};
    
    // Only include media fields if they exist
    if (data.media.main?.id) meta.main = data.media.main.id;
    if (data.media.signature?.id) meta.signature = data.media.signature.id;
    if (data.media.age?.id) meta.age = data.media.age.id;
    
    // Only include customer info if it exists
    if (data.customer_name) meta.customer_name = data.customer_name;
    if (data.customer_email) meta.customer_email = data.customer_email;
    if (data.session_id) meta.session_id = data.session_id;
    
    console.log('Updating post with media and metadata:', {
      postId,
      media: Object.keys(data.media).filter(key => data.media[key]?.id),
      meta: Object.keys(meta)
    });

    return await updatePost(postId, {
      meta
    }, this.config);
  }

  async handleError(error, session_id) {
    console.error('WordPress post creation failed:', {
      error: error.message,
      session_id,
      response_status: error.response?.status,
      response_data: error.response?.data
    });

    await logError(this.config, {
      severity: 'Error',
      scriptName: 'WordPressRepository',
      errorCode: 'WORDPRESS_POST_CREATION_ERROR',
      errorMessage: error.message,
      stackTrace: error.stack,
      additionalContext: JSON.stringify({
        session_id,
        response: error.response?.data
      })
    });
  }
}

module.exports = WordPressRepository;