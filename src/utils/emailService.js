const sendGridMail = require('@sendgrid/mail');

async function sendAppraisalNotification({ config, customerEmail, customerName, sessionId, postUrl }) {
  // Set SendGrid API key
  sendGridMail.setApiKey(config.SENDGRID_API_KEY);

  const emailContent = {
    to: config.ADMIN_EMAIL, // Send to admin
    from: config.EMAIL_SENDER,
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

  try {
    await sendGridMail.send(emailContent);
  } catch (error) {
    console.error('Error sending notification email:', error);
    throw new Error('Failed to send notification email');
  }
}

module.exports = {
  sendAppraisalNotification
};