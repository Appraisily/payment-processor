const express = require('express');
const cors = require('cors');
const setupWebhookRoutes = require('./routes/webhookRoutes');
const setupStripeRoutes = require('./routes/stripeRoutes');
const { setupAppraisalRoutes } = require('./routes/appraisalRoutes');
const setupBulkAppraisalRoutes = require('./routes/bulkAppraisalRoutes');
const loadConfig = require('./config');

async function initializeApp() {
  const app = express();

  try {
    // Load configuration
    console.log('Loading configuration...');
    const config = await loadConfig();
    console.log('Configuration loaded successfully');

    // Configure CORS
    const corsOptions = {
      origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps, curl, etc)
        if (!origin) {
          return callback(null, true);
        }
        
        // Allow all webcontainer domains and appraisily.com
        if (
          origin === 'https://appraisily.com' ||
          origin.endsWith('.appraisily.com') ||
          origin.includes('webcontainer') ||
          origin.includes('stackblitz.io') ||
          process.env.NODE_ENV !== 'production'
        ) {
          return callback(null, true);
        }
        
        callback(new Error('Not allowed by CORS'));
      },
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'x-shared-secret', 'authorization', 'Origin', 'Accept'],
      credentials: true
    };
    
    app.use(cors(corsOptions));
    app.options('*', cors(corsOptions));

    // Setup routes
    setupWebhookRoutes(app, config);
    setupStripeRoutes(app, config);
    setupAppraisalRoutes(app, config);
    setupBulkAppraisalRoutes(app, config);

    // Health check endpoint
    app.get('/', (req, res) => {
      res.send('Service is healthy');
    });

    // Start server
    const PORT = process.env.PORT || 8080;
    app.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to initialize application:', error);
    process.exit(1);
  }
}

initializeApp();