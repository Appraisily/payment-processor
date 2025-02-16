const AppraisalSheetsClient = require('../../../infrastructure/sheets/appraisals');

class SheetsRepository {
  constructor(config) {
    this.config = config;
    this.sheetsClient = new AppraisalSheetsClient(config);
  }

  async recordSubmission(submission, wordpressEditUrl = '') {
    try {
      await this.sheetsClient.recordSubmission({
        session_id: submission.session_id,
        customer_email: submission.customer_email,
        customer_name: submission.customer_name,
        wordpressEditUrl
      });
    } catch (error) {
      console.error('Failed to record in Google Sheets:', error);
    }
  }

  async updateMediaUrls(session_id, mediaUrls) {
    try {
      await this.sheetsClient.updateWordPressMediaUrls(session_id, mediaUrls);
    } catch (error) {
      console.error('Failed to update WordPress media URLs in sheets:', error);
    }
  }

  async updateSubmissionStatus(session_id, editUrl) {
    try {
      await this.sheetsClient.updateSubmissionStatus(session_id, editUrl);
    } catch (error) {
      console.error('Failed to update submission status:', error);
    }
  }

  async updateGCSUrl(session_id, gcsUrl) {
    try {
      await this.sheetsClient.updateGCSUrl(session_id, gcsUrl);
    } catch (error) {
      console.error('Failed to update GCS URL in sheets:', error);
    }
  }
}

module.exports = SheetsRepository;