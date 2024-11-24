const stripeModule = require('stripe');
const { processCheckoutSession } = require('./checkoutProcessor');
const { logError } = require('../utils/errorLogger');

async function handleStripeWebhook(req, res, config, mode) {
  console.log(`Webhook received at /stripe-webhook${mode === 'test' ? '-test' : ''}`);
  console.log(`Headers: ${JSON.stringify(req.headers)}`);

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    const stripe = stripeModule(mode === 'test' ? 
      config.STRIPE_SECRET_KEY_TEST : 
      config.STRIPE_SECRET_KEY_LIVE
    );

    const webhookSecret = mode === 'test' ? 
      config.STRIPE_WEBHOOK_SECRET_TEST : 
      config.STRIPE_WEBHOOK_SECRET_LIVE;

    console.log(`Using webhook secret for ${mode} mode`); // Debug log

    if (!webhookSecret) {
      throw new Error(`Webhook secret not found for ${mode} mode`);
    }

    // Log the raw body type and first few characters
    console.log('Raw body type:', typeof req.body);
    console.log('Raw body preview:', req.body.toString().substring(0, 100));

    // Usar req.body directamente ya que express.raw() lo mantiene como Buffer
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      webhookSecret
    );
    
    console.log(`Event verified in ${mode} mode:`, event.type);

    if (event.type === 'checkout.session.completed') {
      await processCheckoutSession(event.data.object, config, mode);
    }

    res.status(200).send('OK');
  } catch (err) {
    console.error('Error processing webhook:', err);
    await logError(config, {
      timestamp: new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' }),
      severity: 'Error',
      scriptName: 'webhookHandler',
      errorCode: err.code || 'UnknownError',
      errorMessage: err.message,
      stackTrace: err.stack || '',
      userId: '',
      requestId: req.headers['x-request-id'] || '',
      environment: mode,
      endpoint: req.originalUrl || '',
      additionalContext: JSON.stringify({ 
        error: err.message,
        signature: sig,
        mode: mode,
        webhookSecretExists: !!config[mode === 'test' ? 'STRIPE_WEBHOOK_SECRET_TEST' : 'STRIPE_WEBHOOK_SECRET_LIVE']
      }),
      resolutionStatus: 'Open',
      assignedTo: config.ASSIGNED_TO,
      chatGPT: config.CHATGPT_CHAT_URL,
      resolutionLink: config.RESOLUTION_LINK,
    });
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
}

module.exports = {
  handleStripeWebhook
};