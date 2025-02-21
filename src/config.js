const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');

class Config {
  constructor() {
    this.client = new SecretManagerServiceClient();
    this.cachedConfig = null;
  }

  async getSecret(secretName) {
    const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
    const name = `projects/${projectId}/secrets/${secretName}/versions/latest`;

    try {
      const [version] = await this.client.accessSecretVersion({ name });
      return version.payload.data.toString('utf8').trim();
    } catch (error) {
      console.error(`Error accessing secret ${secretName}:`, error);
      throw error;
    }
  }

  async load() {
    if (this.cachedConfig) {
      return this.cachedConfig;
    }

    this.cachedConfig = {
      // Stripe Configuration
      STRIPE_SECRET_KEY_TEST: await this.getSecret('STRIPE_SECRET_KEY_TEST'),
      STRIPE_SECRET_KEY_LIVE: await this.getSecret('STRIPE_SECRET_KEY_LIVE'),
      STRIPE_WEBHOOK_SECRET_TEST: await this.getSecret('STRIPE_WEBHOOK_SECRET_TEST'),
      STRIPE_WEBHOOK_SECRET_LIVE: await this.getSecret('STRIPE_WEBHOOK_SECRET_LIVE'),
      STRIPE_SHARED_SECRET: await this.getSecret('STRIPE_SHARED_SECRET'),

      // Google Sheets Configuration
      SALES_SPREADSHEET_ID: await this.getSecret('SALES_SPREADSHEET_ID'),
      PENDING_APPRAISALS_SPREADSHEET_ID: await this.getSecret('PENDING_APPRAISALS_SPREADSHEET_ID'),
      LOG_SPREADSHEET_ID: await this.getSecret('LOG_SPREADSHEET_ID'),
      SALES_SHEET_NAME: 'Sales',
      PENDING_APPRAISALS_SHEET_NAME: 'Pending Appraisals',

      // SendGrid Configuration
      SENDGRID_API_KEY: await this.getSecret('SENDGRID_API_KEY'),
      EMAIL_SENDER: await this.getSecret('SENDGRID_EMAIL'),
      SENDGRID_TEMPLATE_ID: await this.getSecret('SEND_GRID_TEMPLATE_NOTIFY_PAYMENT_RECEIVED'), 
      SENDGRID_TEMPLATE_BULK_ID: await this.getSecret('SEND_GRID_TEMPLATE_NOTIFY_BULK_PAYMENT_RECEIVED'),

      // WordPress Configuration
      WORDPRESS_API_URL: await this.getSecret('WORDPRESS_API_URL'),
      WORDPRESS_USERNAME: await this.getSecret('wp_username'),
      WORDPRESS_APP_PASSWORD: await this.getSecret('wp_app_password'),
      SHARED_SECRET: await this.getSecret('SHARED_SECRET'),

      // Admin Configuration
      ADMIN_EMAIL: await this.getSecret('ADMIN_EMAIL'),

      // Environment Configuration
      GCS_BUCKET_NAME: process.env.GCS_BUCKET_NAME || 'appraisily-image-backups',
      GCS_BULK_APPRAISAL_BUCKET: await this.getSecret('GCS_BULK_APPRAISAL_BUCKET'),
      CHATGPT_CHAT_URL: process.env.CHATGPT_CHAT_URL || 'https://chatgpt.com/share/e/66e9631f-d6e8-8005-8d38-bc44d9287406',
      RESOLUTION_LINK: process.env.RESOLUTION_LINK || 'https://console.cloud.google.com/functions/details/us-central1/stripeWebhookHandler?project=civil-forge-403609',
      ASSIGNED_TO: process.env.ASSIGNED_TO || 'Your Name',
      APPRAISERS_BACKEND_URL: process.env.APPRAISERS_BACKEND_URL || 'https://appraisers-backend-856401495068.us-central1.run.app/api/update-pending-appraisal',

      // Payment Links Configuration
      PAYMENT_LINKS: {
        'plink_1PzzahAQSJ9n5XyNZTMmYyLJ': { productName: 'Regular' },
        'plink_1OnRh5AQSJ9n5XyNBhDuqbtS': { productName: 'Regular' },
        'plink_1OnRpsAQSJ9n5XyN2BCtWNEs': { productName: 'Insurance' },
        'plink_1OnRzAAQSJ9n5XyNyLmReeCk': { productName: 'IRS' }
      }
    };

    // Construct WordPress admin URL
    const baseUrl = this.cachedConfig.WORDPRESS_API_URL.split('/wp-json')[0];
    this.cachedConfig.WORDPRESS_ADMIN_URL = `${baseUrl}/wp-admin`;

    return this.cachedConfig;
  }
}

// Export a singleton instance
const config = new Config();
module.exports = config.load.bind(config);