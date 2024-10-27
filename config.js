// config.js

const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
const path = require('path');

const client = new SecretManagerServiceClient();

/**
 * Fetch a secret from Secret Manager.
 *
 * @param {string} secretName - The name of the secret.
 * @returns {Promise<string>} - The secret payload.
 */
async function getSecret(secretName) {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  const name = `projects/${projectId}/secrets/${secretName}/versions/latest`;

  try {
    const [version] = await client.accessSecretVersion({ name });
    const payload = version.payload.data.toString('utf8');
    return payload;
  } catch (error) {
    console.error(`Error accessing secret ${secretName}:`, error);
    throw error;
  }
}

/**
 * Load all required secrets.
 *
 * @returns {Promise<Object>} - An object containing all secrets.
 */
async function loadConfig() {
  return {
    // Stripe API Keys
    STRIPE_SECRET_KEY_TEST: await getSecret('STRIPE_SECRET_KEY_TEST'),
    STRIPE_SECRET_KEY_LIVE: await getSecret('STRIPE_SECRET_KEY_LIVE'),

    // Stripe Webhook Secrets
    STRIPE_WEBHOOK_SECRET_TEST: await getSecret('STRIPE_WEBHOOK_SECRET_TEST'),
    STRIPE_WEBHOOK_SECRET_LIVE: await getSecret('STRIPE_WEBHOOK_SECRET_LIVE'),

    // Google Sheets IDs
    SALES_SPREADSHEET_ID: await getSecret('SALES_SPREADSHEET_ID'),
    PENDING_APPRAISALS_SPREADSHEET_ID: await getSecret('PENDING_APPRAISALS_SPREADSHEET_ID'),
    LOG_SPREADSHEET_ID: await getSecret('LOG_SPREADSHEET_ID'),

    // Sheet Names (Non-sensitive, can remain hardcoded or fetched similarly if preferred)
    SALES_SHEET_NAME: 'Sales',
    PENDING_APPRAISALS_SHEET_NAME: 'Pending Appraisals',

    // SendGrid Configuration
    SENDGRID_API_KEY: await getSecret('SENDGRID_API_KEY'),
    EMAIL_SENDER: await getSecret('SENDGRID_EMAIL'),
    SENDGRID_TEMPLATE_ID: await getSecret('SEND_GRID_TEMPLATE_NOTIFY_APPRAISAL_COMPLETED'),

    // Static URLs and Assignments (Non-sensitive)
    CHATGPT_CHAT_URL: 'https://chatgpt.com/share/e/66e9631f-d6e8-8005-8d38-bc44d9287406',
    RESOLUTION_LINK: 'https://console.cloud.google.com/functions/details/us-central1/stripeWebhookHandler?project=civil-forge-403609',
    ASSIGNED_TO: 'Your Name',

    // Payment Links Mapping (Non-sensitive, can remain hardcoded)
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
}

module.exports = loadConfig;
