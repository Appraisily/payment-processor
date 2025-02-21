const { PubSub } = require('@google-cloud/pubsub');

class NotificationService {
  constructor(config) {
    this.config = config;
    this.pubsub = new PubSub();
  }

  async publishToCRM(message) {
    try {
      const topicName = process.env.PUBSUB_CRM_NAME;
      if (!topicName) {
        console.error('PUBSUB_CRM_NAME environment variable not set');
        return;
      }

      const topic = this.pubsub.topic(topicName);
      const messageBuffer = Buffer.from(JSON.stringify(message));
      
      const messageId = await topic.publish(messageBuffer);
      console.log(`Message ${messageId} published to CRM topic`);
    } catch (error) {
      console.error('Error publishing to CRM PubSub:', error);
    }
  }

  async publishFinalizationMessage(sessionId, appraisalType, sessionStatus, customerInfo) {
    await this.publishToCRM({
      crmProcess: "bulkAppraisalFinalized",
      customer: {
        email: customerInfo?.email || sessionStatus.session.customer_email || '',
        notes: customerInfo?.notes || ''
      },
      appraisal: {
        type: appraisalType,
        itemCount: sessionStatus.session.items.length,
        sessionId: sessionId
      },
      metadata: {
        origin: "payment-processor",
        environment: process.env.NODE_ENV || 'production',
        timestamp: Math.floor(Date.now() / 1000)
      }
    });
  }
}