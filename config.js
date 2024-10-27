// config.js

const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');

const client = new SecretManagerServiceClient();

let cachedConfig = null;

/**
 * Obtiene un secreto desde Secret Manager.
 *
 * @param {string} secretName - Nombre del secreto.
 * @returns {Promise<string>} - El valor del secreto.
 */
async function getSecret(secretName) {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  const name = `projects/${projectId}/secrets/${secretName}/versions/latest`;

  try {
    const [version] = await client.accessSecretVersion({ name });
    const payload = version.payload.data.toString('utf8');
    return payload;
  } catch (error) {
    console.error(`Error accediendo al secreto ${secretName}:`, error);
    throw error;
  }
}

/**
 * Carga toda la configuración necesaria obteniendo los secretos.
 *
 * @returns {Promise<Object>} - Un objeto que contiene todas las configuraciones.
 */
async function loadConfig() {
  if (cachedConfig) {
    return cachedConfig;
  }

  cachedConfig = {
    // Claves de API de Stripe
    STRIPE_SECRET_KEY_TEST: await getSecret('STRIPE_SECRET_KEY_TEST'),
    STRIPE_SECRET_KEY_LIVE: await getSecret('STRIPE_SECRET_KEY_LIVE'),

    // Secretos de Webhook de Stripe
    STRIPE_WEBHOOK_SECRET_TEST: await getSecret('STRIPE_WEBHOOK_SECRET_TEST'),
    STRIPE_WEBHOOK_SECRET_LIVE: await getSecret('STRIPE_WEBHOOK_SECRET_LIVE'),

    // IDs de Google Sheets
    SALES_SPREADSHEET_ID: await getSecret('SALES_SPREADSHEET_ID'),
    PENDING_APPRAISALS_SPREADSHEET_ID: await getSecret('PENDING_APPRAISALS_SPREADSHEET_ID'),
    LOG_SPREADSHEET_ID: await getSecret('LOG_SPREADSHEET_ID'),

    // Nombres de las Hojas (No sensibles)
    SALES_SHEET_NAME: 'Sales',
    PENDING_APPRAISALS_SHEET_NAME: 'Pending Appraisals',

    // Configuración de SendGrid
    SENDGRID_API_KEY: await getSecret('SENDGRID_API_KEY'),
    EMAIL_SENDER: await getSecret('SENDGRID_EMAIL'),
    SENDGRID_TEMPLATE_ID: await getSecret('SEND_GRID_TEMPLATE_NOTIFY_PAYMENT_RECEIVED'), // Actualizado

    // URLs y Asignaciones (No sensibles)
    CHATGPT_CHAT_URL: 'https://chatgpt.com/share/e/66e9631f-d6e8-8005-8d38-bc44d9287406',
    RESOLUTION_LINK: 'https://console.cloud.google.com/functions/details/us-central1/stripeWebhookHandler?project=civil-forge-403609',
    ASSIGNED_TO: 'Tu Nombre',

    // Mapeo de Payment Links (No sensibles)
    PAYMENT_LINKS: {
      'plink_1PzzahAQSJ9n5XyNZTMmYyLJ': {
        productName: 'Regular Appraisal',
      },
      'plink_1Q0f4WAQSJ9n5XyNzAodIQMC': {
        productName: 'Premium Appraisal',
      },
      // Añade más payment links y sus productos correspondientes aquí
    },
  };

  return cachedConfig;
}

module.exports = loadConfig;
