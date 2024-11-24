const express = require('express');
const { setupWebhookRoutes } = require('./routes/webhookRoutes');
const loadConfig = require('./config');

async function initializeApp() {
  const app = express();

  try {
    // Load configuration first
    console.log('Loading configuration...');
    const config = await loadConfig();
    console.log('Configuration loaded successfully');

    if (!config.STRIPE_WEBHOOK_SECRET_LIVE || !config.STRIPE_WEBHOOK_SECRET_TEST) {
      throw new Error('Webhook secrets not properly loaded');
    }

    // Setup webhook routes (must be before express.json() middleware)
    setupWebhookRoutes(app, config);

    // Global middleware to parse JSON bodies for routes other than webhooks
    app.use(express.json());

    // Health Check Endpoint
    app.get('/', (req, res) => {
      res.send('Cloud Run service is active and running.');
    });

    // Start the server
    const PORT = process.env.PORT || 8080;
    app.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to initialize the application:', error);
    process.exit(1);
  }
}

// Start initialization
initializeApp();