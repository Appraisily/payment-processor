const stripeModule = require('stripe');

class StripeClient {
  constructor(config) {
    this.testClient = stripeModule(config.STRIPE_SECRET_KEY_TEST);
    this.liveClient = stripeModule(config.STRIPE_SECRET_KEY_LIVE);
    this.webhookSecretTest = config.STRIPE_WEBHOOK_SECRET_TEST;
    this.webhookSecretLive = config.STRIPE_WEBHOOK_SECRET_LIVE;
  }

  getClient(mode) {
    return mode === 'test' ? this.testClient : this.liveClient;
  }

  getWebhookSecret(mode) {
    return mode === 'test' ? this.webhookSecretTest : this.webhookSecretLive;
  }

  async verifyWebhookSignature(rawBody, signature, mode) {
    const webhookSecret = this.getWebhookSecret(mode);
    if (!webhookSecret) {
      throw new Error(`Webhook secret not found for ${mode} mode`);
    }

    const client = this.getClient(mode);
    return client.webhooks.constructEvent(rawBody, signature, webhookSecret);
  }

  async retrieveSession(sessionId, mode) {
    const client = this.getClient(mode);
    return await client.checkout.sessions.retrieve(sessionId, {
      expand: ['customer_details']
    });
  }
}

module.exports = StripeClient;