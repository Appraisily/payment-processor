const { PubSub } = require('@google-cloud/pubsub');

class PubSubRepository {
  constructor(config) {
    this.config = config;
    this.pubsub = new PubSub();
  }

  async publishPaymentEvent(session, mode, isBulkOrder) {
    try {
      const topicName = process.env.PUBSUB_CRM_NAME;
      if (!topicName) {
        console.error('PUBSUB_CRM_NAME environment variable not set');
        return;
      }

      const message = {
        crmProcess: "stripePayment",
        customer: {
          email: session.customer_details?.email,
          name: session.customer_details?.name,
          stripeCustomerId: session.customer
        },
        payment: {
          checkoutSessionId: session.id,
          paymentIntentId: session.payment_intent,
          amount: session.amount_total / 100,
          currency: session.currency,
          status: session.payment_status,
          metadata: {
            serviceType: isBulkOrder ? 
              `Bulk Appraisal - ${session.metadata?.appraisal_type || 'Regular'}` :
              this.config.PAYMENT_LINKS[session.payment_link]?.productName || 'Unknown',
            sessionId: session.id,
            isBulkOrder,
            bulkSessionId: isBulkOrder ? session.client_reference_id : undefined
          }
        },
        metadata: {
          origin: "payment-processor",
          environment: mode,
          timestamp: Math.floor(Date.now() / 1000)
        }
      };

      const topic = this.pubsub.topic(topicName);
      const messageBuffer = Buffer.from(JSON.stringify(message));
      
      const messageId = await topic.publish(messageBuffer);
      console.log(`Message ${messageId} published to CRM topic`);
    } catch (error) {
      console.error('Error publishing to CRM PubSub:', error);
      // Don't throw error to avoid interrupting the main flow
    }
  }
}

module.exports = PubSubRepository;