const express = require('express');
const cors = require('cors');
const { setupWebhookRoutes } = require('./routes/webhookRoutes');
const { setupStripeRoutes } = require('./routes/stripeRoutes');
const { setupAppraisalRoutes } = require('./routes/appraisalRoutes');
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
    
    // Configure CORS for WebContainer origins
    const corsOptions = {
      origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        
        // Allow appraisily.com and subdomains
        if (origin.endsWith('appraisily.com')) {
          return callback(null, true);
        }
        
        // Allow WebContainer origins
        if (origin.includes('webcontainer-api.io')) {
          return callback(null, true);
        }
        
        // Allow local development
        if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
          return callback(null, true);
        }
        
        callback(new Error('Not allowed by CORS'));
      },
      methods: ['GET', 'POST'],
      allowedHeaders: ['Content-Type', 'x-shared-secret'],
      credentials: true
    };
    
    // Apply CORS middleware
    app.use(cors(corsOptions));

    // Setup webhook routes (must be before express.json() middleware)
    setupWebhookRoutes(app, config);

    // Setup Stripe routes
    setupStripeRoutes(app, config);

    // Setup Appraisal routes
    setupAppraisalRoutes(app, config);

    // Global middleware to parse JSON bodies for routes other than webhooks

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