const sendGridMail = require('@sendgrid/mail');

class SendGridClient {
  constructor(config) {
    this.config = config;
    sendGridMail.setApiKey(config.SENDGRID_API_KEY);
  }

  async sendConfirmationEmail(customerEmail, customerName, sessionId) {
    const emailContent = {
      to: customerEmail,
      from: this.config.EMAIL_SENDER,
      templateId: this.config.SENDGRID_TEMPLATE_ID,
      dynamic_template_data: {
        customer_name: customerName,
        session_id: sessionId,
        current_year: new Date().getFullYear()
      }
    };

    await sendGridMail.send(emailContent);
  }

  async sendAppraisalNotification(customerEmail, customerName, sessionId, postUrl) {
    const emailContent = {
      to: this.config.ADMIN_EMAIL,
      from: this.config.EMAIL_SENDER,
      subject: `New Appraisal Submission - ${sessionId}`,
      text: `
        New appraisal submission received:
        
        Session ID: ${sessionId}
        Customer: ${customerName || 'Not provided'}
        Email: ${customerEmail}
        
        View submission: ${postUrl}
      `,
      html: `
        <h2>New Appraisal Submission</h2>
        <p>A new appraisal submission has been received.</p>
        
        <ul>
          <li><strong>Session ID:</strong> ${sessionId}</li>
          <li><strong>Customer:</strong> ${customerName || 'Not provided'}</li>
          <li><strong>Email:</strong> ${customerEmail}</li>
        </ul>
        
        <p><a href="${postUrl}">View submission in WordPress</a></p>
      `
    };

    await sendGridMail.send(emailContent);
  }
}

module.exports = SendGridClient;