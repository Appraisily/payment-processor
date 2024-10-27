// config.js

module.exports = {
  // Stripe API Keys
  STRIPE_SECRET_KEY_TEST: process.env.STRIPE_SECRET_KEY_TEST,
  STRIPE_SECRET_KEY_LIVE: process.env.STRIPE_SECRET_KEY_LIVE,

  // Stripe Webhook Secrets
  STRIPE_WEBHOOK_SECRET_TEST: process.env.STRIPE_WEBHOOK_SECRET_TEST,
  STRIPE_WEBHOOK_SECRET_LIVE: process.env.STRIPE_WEBHOOK_SECRET_LIVE,

  // Google Sheets IDs
  SALES_SPREADSHEET_ID: process.env.SALES_SPREADSHEET_ID,
  PENDING_APPRAISALS_SPREADSHEET_ID: process.env.PENDING_APPRAISALS_SPREADSHEET_ID,
  LOG_SPREADSHEET_ID: process.env.LOG_SPREADSHEET_ID,

  // Sheet Names
  SALES_SHEET_NAME: 'Sales',
  PENDING_APPRAISALS_SHEET_NAME: 'Pending Appraisals',

  // SendGrid Configuration
  SENDGRID_API_KEY: process.env.SENDGRID_API_KEY,
  EMAIL_SENDER: process.env.EMAIL_SENDER,
  SENDGRID_TEMPLATE_ID: process.env.SENDGRID_TEMPLATE_ID,

  // Static URLs
  CHATGPT_CHAT_URL: 'https://chatgpt.com/share/e/66e9631f-d6e8-8005-8d38-bc44d9287406',
  RESOLUTION_LINK: 'https://console.cloud.google.com/functions/details/us-central1/stripeWebhookHandler?project=civil-forge-403609',

  // Assignment
  ASSIGNED_TO: 'Your Name',

  // Payment Links Mapping
  PAYMENT_LINKS: {
    'plink_1PzzahAQSJ9n5XyNZTMmYyLJ': {
      productName: 'Regular Appraisal',
    },
    'plink_1Q0f4WAQSJ9n5XyNzAodIQMC': {
      productName: 'Premium Appraisal',
    },
    // Add more payment links and their corresponding products here
  },
};
