const { validateAppraisalSubmission } = require('./validator');
const AppraisalRepository = require('./repository');

class AppraisalService {
  constructor(config) {
    this.config = config;
    this.repository = new AppraisalRepository(config);
  }

  async processSubmission(submission) {
    // Validate submission
    const validationError = validateAppraisalSubmission(submission);
    if (validationError) {
      throw new Error(validationError);
    }

    // Process the submission
    return await this.repository.createAppraisal(submission);
  }
}

module.exports = AppraisalService;