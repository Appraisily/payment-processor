const { validateAppraisalSubmission } = require('./validator');
const AppraisalRepository = require('./repository');

class AppraisalService {
  constructor(config) {
    this.config = config;
    this.repository = new AppraisalRepository(config);
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
      const result = await this.repository.createAppraisal(submission);
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