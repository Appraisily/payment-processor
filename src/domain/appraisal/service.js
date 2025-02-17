const { validateAppraisalSubmission } = require('./validator');
const WordPressRepository = require('./repositories/wordpress.repository');
const SheetsRepository = require('./repositories/sheets.repository');
const StorageRepository = require('./repositories/storage.repository');
const AppraisersRepository = require('./repositories/appraisers.repository');

class AppraisalService {
  constructor(config) {
    this.config = config;
    this.wordpressRepo = new WordPressRepository(config);
    this.sheetsRepo = new SheetsRepository(config);
    this.storageRepo = new StorageRepository(config);
    this.appraisersRepo = new AppraisersRepository(config);
  }

  async processSubmission(submission) {
    console.log('Processing submission:', {
      session_id: submission.session_id,
      hasFiles: !!submission.files
    });

    // Validate submission
    const validationError = validateAppraisalSubmission(submission);
    if (validationError) {
      console.error('Validation error:', validationError);
      throw new Error(validationError);
    }

    // Process the submission
    try {
      // Start file backup early
      const backupPromise = this.storageRepo.backupFiles(submission.images, {
        session_id: submission.session_id,
        customer_email: submission.customer_email,
        customer_name: submission.customer_name,
        description: submission.description,
        payment_id: submission.payment_id,
        post_id: 'pending'
      });

      // Create WordPress post
      const post = await this.wordpressRepo.createPost(submission);

      // Record in sheets
      await this.sheetsRepo.recordSubmission(submission, post?.editUrl);

      // Process images if any
      let uploadedMedia = {};
      if (submission.images?.main) {
        uploadedMedia = await this.wordpressRepo.uploadMedia(submission.images);

        if (post) {
          await this.wordpressRepo.updatePostWithMedia(post.id, {
            media: uploadedMedia,
            customer_name: submission.customer_name,
            customer_email: submission.customer_email,
            session_id: submission.session_id
          });

          await this.sheetsRepo.updateMediaUrls(submission.session_id, {
            main: uploadedMedia.main?.url || '',
            signature: uploadedMedia.signature?.url || '',
            age: uploadedMedia.age?.url || ''
          });
        }

        // Notify appraisers backend
        await this.appraisersRepo.notifySubmission(
          submission,
          post?.editUrl || '',
          uploadedMedia
        );

        // Update sheets status
        if (post) {
          await this.sheetsRepo.updateSubmissionStatus(submission.session_id, post.editUrl);
        }
      }

      // Wait for backup to complete
      const backupUrls = await backupPromise;

      // Update GCS URL in sheets if backup was successful
      if (backupUrls?.main) {
        await this.sheetsRepo.updateGCSUrl(submission.session_id, backupUrls.main);
      }

      const result = {
        id: post?.id || null,
        editUrl: post?.editUrl || null,
        media: uploadedMedia,
        backupUrls
      };

      console.log('Appraisal created successfully:', {
        id: result.id,
        session_id: submission.session_id
      });

      return result;
    } catch (error) {
      console.error('Error creating appraisal:', {
        error: error.message,
        session_id: submission.session_id
      });
      throw error;
    }
  }
}

module.exports = AppraisalService;