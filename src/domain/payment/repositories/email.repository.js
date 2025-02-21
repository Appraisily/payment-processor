const sendGridMail = require('@sendgrid/mail');

class EmailRepository {
  constructor(config) {
    this.config = config;
    sendGridMail.setApiKey(config.SENDGRID_API_KEY);
  }

  async sendConfirmationEmail(session) {
    const emailContent = {
      to: session.customer_details?.email,
      from: this.config.EMAIL_SENDER,
      templateId: this.config.SENDGRID_TEMPLATE_ID,
      dynamic_template_data: {
        customer_name: session.customer_details?.name,
        session_id: session.id,
        current_year: new Date().getFullYear(),
      },
    };

    await sendGridMail.send(emailContent);
  }

  async sendBulkConfirmationEmail(session) {
    const bulkSessionId = session.client_reference_id.replace('bulk_', '');
    const bulkAppraisalService = new (require('../../bulk-appraisal/service'))(this.config);
    const sessionStatus = await bulkAppraisalService.getSessionStatus(bulkSessionId);
    
    const emailContent = {
      to: session.customer_details?.email,
      from: this.config.EMAIL_SENDER,
      templateId: this.config.SENDGRID_TEMPLATE_BULK_ID,
      dynamic_template_data: {
        customer_name: session.customer_details?.name,
        session_id: session.id,
        current_year: new Date().getFullYear(),
        items_count: sessionStatus.session.items.length,
        appraisal_type: session.metadata?.appraisal_type || 'Regular'
      },
    };
    
    await sendGridMail.send(emailContent);
  }
}

module.exports = EmailRepository;