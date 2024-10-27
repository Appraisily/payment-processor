const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');

class ConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

class SecretManager {
  constructor() {
    this.client = new SecretManagerServiceClient();
    this.projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
    
    if (!this.projectId) {
      throw new ConfigurationError('GOOGLE_CLOUD_PROJECT_ID environment variable is not set');
    }
  }

  async getSecret(secretName) {
    const name = `projects/${this.projectId}/secrets/${secretName}/versions/latest`;

    try {
      const [version] = await this.client.accessSecretVersion({ name });
      return version.payload.data.toString('utf8');
    } catch (error) {
      throw new ConfigurationError(`Failed to access secret ${secretName}: ${error.message}`);
    }
  }
}

const PAYMENT_LINKS = {
  'plink_1PzzahAQSJ9n5XyNZTMmYyLJ': {
    productName: 'Regular Appraisal',
  },
  'plink_1Q0f4WAQSJ9n5XyNzAodIQMC': {
    productName: 'Premium Appraisal',
  },
};

const SHEET_NAMES = {
  SALES: 'Sales',
  PENDING_APPRAISALS: 'Pending Appraisals',
};

const STATIC_CONFIG = {
  CHATGPT_CHAT_URL: 'https://chatgpt.com/share/e/66e9631f-d6e8-8005-8d38-bc44d9287406',
  RESOLUTION_LINK: 'https://console.cloud.google.com/functions/details/us-central1/stripeWebhookHandler?project=civil-forge-403609',
  ASSIGNED_TO: process.env.ASSIGNED_TO || 'System Administrator',
};

async function loadConfig() {
  try {
    const secretManager = new SecretManager();

    // Define required secrets
    const requiredSecrets = [
      'STRIPE_SECRET_KEY_TEST',
      'STRIPE_SECRET_KEY_LIVE',
      'STRIPE_WEBHOOK_SECRET_TEST',
      'STRIPE_WEBHOOK_SECRET_LIVE',
      'SALES_SPREADSHEET_ID',
      'PENDING_APPRAISALS_SPREADSHEET_ID',
      'LOG_SPREADSHEET_ID',
      'SENDGRID_API_KEY',
      'SENDGRID_EMAIL',
      'SEND_GRID_TEMPLATE_NOTIFY_APPRAISAL_COMPLETED'
    ];

    // Load all secrets in parallel
    const secrets = await Promise.all(
      requiredSecrets.map(async (secretName) => {
        const value = await secretManager.getSecret(secretName);
        return [secretName, value];
      })
    );

    // Convert secrets array to object
    const config = Object.fromEntries(secrets);

    // Return complete configuration
    return {
      // Stripe Configuration
      STRIPE_SECRET_KEY_TEST: config.STRIPE_SECRET_KEY_TEST,
      STRIPE_SECRET_KEY_LIVE: config.STRIPE_SECRET_KEY_LIVE,
      STRIPE_WEBHOOK_SECRET_TEST: config.STRIPE_WEBHOOK_SECRET_TEST,
      STRIPE_WEBHOOK_SECRET_LIVE: config.STRIPE_WEBHOOK_SECRET_LIVE,

      // Google Sheets Configuration
      SALES_SPREADSHEET_ID: config.SALES_SPREADSHEET_ID,
      PENDING_APPRAISALS_SPREADSHEET_ID: config.PENDING_APPRAISALS_SPREADSHEET_ID,
      LOG_SPREADSHEET_ID: config.LOG_SPREADSHEET_ID,
      SALES_SHEET_NAME: SHEET_NAMES.SALES,
      PENDING_APPRAISALS_SHEET_NAME: SHEET_NAMES.PENDING_APPRAISALS,

      // SendGrid Configuration
      SENDGRID_API_KEY: config.SENDGRID_API_KEY,
      EMAIL_SENDER: config.SENDGRID_EMAIL,
      SENDGRID_TEMPLATE_ID: config.SEND_GRID_TEMPLATE_NOTIFY_APPRAISAL_COMPLETED,

      // Static Configuration
      ...STATIC_CONFIG,

      // Payment Links Configuration
      PAYMENT_LINKS,
    };
  } catch (error) {
    console.error('Failed to load configuration:', error);
    throw new ConfigurationError(`Configuration loading failed: ${error.message}`);
  }
}

module.exports = loadConfig;
