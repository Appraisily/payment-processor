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
    const session = await client.checkout.sessions.retrieve(sessionId, {
      expand: ['customer_details', 'line_items']
    });

    console.log('Retrieved Stripe session details:', {
      id: session.id,
      payment_status: session.payment_status,
      amount_total: session.amount_total,
      currency: session.currency,
      customer_details: {
        email: session.customer_details?.email,
        name: session.customer_details?.name
      },
      metadata: session.metadata,
      line_items: session.line_items?.data.map(item => ({
        id: item.id,
        quantity: item.quantity,
        amount_total: item.amount_total,
        description: item.description,
        price: {
          id: item.price?.id,
          unit_amount: item.price?.unit_amount,
          product: item.price?.product
        }
      }))
    });

    return session;
  }
}

module.exports = StripeClient;