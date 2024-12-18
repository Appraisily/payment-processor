const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');

const client = new SecretManagerServiceClient();
let cachedConfig = null;

async function getSecret(secretName) {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  const name = `projects/${projectId}/secrets/${secretName}/versions/latest`;

  try {
    const [version] = await client.accessSecretVersion({ name });
    return version.payload.data.toString('utf8').trim();
  } catch (error) {
    console.error(`Error accessing secret ${secretName}:`, error);
    throw error;
  }
}

async function loadConfig() {
  if (cachedConfig) {
    return cachedConfig;
  }

  cachedConfig = {
    // Stripe API Keys
    STRIPE_SECRET_KEY_TEST: await getSecret('STRIPE_SECRET_KEY_TEST'),
    STRIPE_SECRET_KEY_LIVE: await getSecret('STRIPE_SECRET_KEY_LIVE'),
    STRIPE_WEBHOOK_SECRET_TEST: await getSecret('STRIPE_WEBHOOK_SECRET_TEST'),
    STRIPE_WEBHOOK_SECRET_LIVE: await getSecret('STRIPE_WEBHOOK_SECRET_LIVE'),
    STRIPE_SHARED_SECRET: await getSecret('STRIPE_SHARED_SECRET'),

    // Google Sheets IDs
    SALES_SPREADSHEET_ID: await getSecret('SALES_SPREADSHEET_ID'),
    PENDING_APPRAISALS_SPREADSHEET_ID: await getSecret('PENDING_APPRAISALS_SPREADSHEET_ID'),
    LOG_SPREADSHEET_ID: await getSecret('LOG_SPREADSHEET_ID'),

    // Sheet Names
    SALES_SHEET_NAME: 'Sales',
    PENDING_APPRAISALS_SHEET_NAME: 'Pending Appraisals',

    // SendGrid Configuration
    SENDGRID_API_KEY: await getSecret('SENDGRID_API_KEY'),
    EMAIL_SENDER: await getSecret('SENDGRID_EMAIL'),
    SENDGRID_TEMPLATE_ID: await getSecret('SEND_GRID_TEMPLATE_NOTIFY_PAYMENT_RECEIVED'),
    
    // WordPress Configuration
    WORDPRESS_API_URL: await getSecret('WORDPRESS_API_URL'),
    WORDPRESS_USERNAME: await getSecret('wp_username'),
    WORDPRESS_APP_PASSWORD: await getSecret('wp_app_password'),
    
    // Admin Configuration
    ADMIN_EMAIL: await getSecret('ADMIN_EMAIL'),

    // URLs and Assignments
    CHATGPT_CHAT_URL: process.env.CHATGPT_CHAT_URL || 'https://chatgpt.com/share/e/66e9631f-d6e8-8005-8d38-bc44d9287406',
    RESOLUTION_LINK: process.env.RESOLUTION_LINK || 'https://console.cloud.google.com/functions/details/us-central1/stripeWebhookHandler?project=civil-forge-403609',
    ASSIGNED_TO: process.env.ASSIGNED_TO || 'Your Name',

    // Payment Links Mapping
    PAYMENT_LINKS: {
      'plink_1PzzahAQSJ9n5XyNZTMmYyLJ': { productName: 'RegularArt' },
      'plink_1OnRh5AQSJ9n5XyNBhDuqbtS': { productName: 'RegularArt' },
      'plink_1OnRpsAQSJ9n5XyN2BCtWNEs': { productName: 'InsuranceArt' },
      'plink_1OnRzAAQSJ9n5XyNyLmReeCk': { productName: 'TaxArt' },
    },
  };

  // Construct WordPress admin URL from API URL
  // Example: If API URL is "https://resources.appraisily.com/wp-json/wp/v2"
  // Extract base URL "https://resources.appraisily.com"
  const baseUrl = cachedConfig.WORDPRESS_API_URL.split('/wp-json')[0];
  cachedConfig.WORDPRESS_ADMIN_URL = `${baseUrl}/wp-admin`;

  return cachedConfig;
}

module.exports = loadConfig;