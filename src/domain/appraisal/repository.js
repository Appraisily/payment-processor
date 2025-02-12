const { createPost, uploadMedia, updatePost } = require('../../infrastructure/wordpress/client');
const GCSClient = require('../../infrastructure/storage/gcs');
const { logError } = require('../../utils/error/logger');
const AppraisalSheetsClient = require('../../infrastructure/sheets/appraisals');
const AppraisersBackendClient = require('../../infrastructure/appraisers/client');

class AppraisalRepository {
  constructor(config) {
    this.config = config;
    this.gcsClient = new GCSClient(config);
    this.sheetsClient = new AppraisalSheetsClient(config);
    this.appraisersClient = new AppraisersBackendClient(config);
  }

  async createAppraisal(submission) {
    const { session_id, images, customer_email, customer_name } = submission;
    let uploadedMedia = {};
    let post = null;
    let backupPromise = null;

    try {
      // Start file backup early using GCS client
      backupPromise = images?.main ? this.gcsClient.backupFiles(images, {
        session_id,
        customer_email,
        post_id: 'pending'
      }) : Promise.resolve(null);

      // Create minimal WordPress post first
      try {
        console.log('Attempting to create WordPress post:', {
          session_id,
          customer_email,
          minimal: true
        });

        post = await createPost({
          title: `Art Appraisal Request - ${session_id}`,
          content: ' ',
          status: 'draft'
        }, this.config);

        console.log('WordPress post created successfully:', {
          post_id: post.id,
          edit_url: post.editUrl
        });

        // Now update the post with metadata
        try {
          await updatePost(post.id, {
            meta: {
              session_id,
              customer_email,
              customer_name,
              main: '',
              signature: '',
              age: ''
            }
          }, this.config);
          console.log('Updated WordPress post with metadata');
        } catch (metaError) {
          console.error('Failed to update post metadata:', metaError);
          // Continue execution despite metadata update error
        }
      } catch (wpError) {
        console.error('WordPress post creation failed:', {
          error: wpError.message,
          session_id,
          response_status: wpError.response?.status,
          response_data: wpError.response?.data
        });

        await logError(this.config, {
          severity: 'Error',
          scriptName: 'AppraisalRepository',
          errorCode: 'WORDPRESS_POST_CREATION_ERROR',
          errorMessage: wpError.message,
          stackTrace: wpError.stack,
          additionalContext: JSON.stringify({
            session_id,
            response: wpError.response?.data
          })
        });

        // Continue execution despite WordPress error
        console.log('Continuing process despite WordPress error');
      }

      // Record in Google Sheets
      try {
        await this.sheetsClient.recordSubmission({
          session_id,
          customer_email,
          customer_name,
          wordpressEditUrl: post?.editUrl || ''
        });
        console.log('Recorded submission in Google Sheets');
      } catch (sheetsError) {
        console.error('Failed to record in Google Sheets:', sheetsError);
        // Continue execution despite sheets error
      }

      // Process images if any
      if (images?.main) {
        uploadedMedia = await this.uploadAllMedia(images);

        // Only update WordPress if post was created
        if (post) {
          try {
            await this.updatePostMedia(post.id, {
              media: uploadedMedia,
              customer_name,
              customer_email,
              session_id
            });
            console.log('Updated WordPress post with media');

            // Update WordPress media URLs in sheets
            try {
              await this.sheetsClient.updateWordPressMediaUrls(session_id, {
                main: uploadedMedia.main?.url || '',
                signature: uploadedMedia.signature?.url || '',
                age: uploadedMedia.age?.url || ''
              });
            } catch (urlsError) {
              console.error('Failed to update WordPress media URLs in sheets:', urlsError);
              // Continue execution despite URLs update error
            }
          } catch (mediaError) {
            console.error('Failed to update WordPress post with media:', mediaError);
            // Continue execution despite media update error
          }
        }

        // Notify appraisers backend
        try {
          await this.appraisersClient.notifySubmission({
            session_id,
            customer_email,
            customer_name,
            description: submission.description,
            wordpress_url: post?.editUrl || '',
            images: {
              main: uploadedMedia.main?.url || '',
              signature: uploadedMedia.signature?.url || '',
              age: uploadedMedia.age?.url || ''
            },
            payment_id: submission.payment_id
          });
          console.log('Notified appraisers backend successfully');
        } catch (backendError) {
          console.error('Failed to notify appraisers backend:', backendError);
          // Continue execution despite backend notification error
        }
        
        // Update sheets status after media upload
        if (post) {
          try {
            await this.sheetsClient.updateSubmissionStatus(session_id, post.editUrl);
            console.log('Updated submission status in sheets');
          } catch (statusError) {
            console.error('Failed to update submission status:', statusError);
            // Continue execution despite status update error
          }
        }
      }

      // Wait for backup to complete
      const backupUrls = await backupPromise;

      // Update GCS URL in sheets if backup was successful
      if (backupUrls?.main) {
        try {
          await this.sheetsClient.updateGCSUrl(session_id, backupUrls.main);
        } catch (gcsError) {
          console.error('Failed to update GCS URL in sheets:', gcsError);
          // Continue execution despite GCS URL update error
        }
      }

      return {
        id: post?.id || null,
        editUrl: post?.editUrl || null,
        media: uploadedMedia,
        backupUrls
      };

    } catch (error) {
      await logError(this.config, {
        timestamp: new Date().toISOString(),
        severity: 'Error',
        scriptName: 'AppraisalRepository',
        errorCode: 'APPRAISAL_CREATION_ERROR',
        errorMessage: error.message,
        stackTrace: error.stack,
        additionalContext: JSON.stringify({ 
          session_id,
          hasFiles: !!images?.main,
          error: error.response?.data || error.message
        })
      });
      throw error;
    }
  }

  async uploadAllMedia(processedImages) {
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

  async updatePostMedia(postId, data) {
    return await updatePost(postId, {
      meta: {
        // Media IDs
        main: data.media.main?.id || '',
        signature: data.media.signature?.id || '',
        age: data.media.age?.id || '',
        // Customer information
        customer_name: data.customer_name,
        customer_email: data.customer_email,
        session_id: data.session_id
      }
    }, this.config);
  }
}

module.exports = AppraisalRepository;