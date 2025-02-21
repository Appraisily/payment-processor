const SessionService = require('./services/session.service');
const FileService = require('./services/file.service');
const NotificationService = require('./services/notification.service');
const CustomerRepository = require('./repositories/customer.repository'); 

class BulkAppraisalService {
  constructor(config) {
    this.sessionService = new SessionService(config);
    this.fileService = new FileService(config);
    this.notificationService = new NotificationService(config);
    this.customerRepo = new CustomerRepository(config);
    this.config = config;
  }

  async initializeSession() {
    return await this.sessionService.initializeSession();
  }

  async uploadFile(sessionId, file, metadata) {
    return await this.fileService.uploadFile(sessionId, file, metadata);
  }

  async deleteFile(sessionId, fileId) {
    return await this.fileService.deleteFile(sessionId, fileId);
  }

  async updateItemDescription(sessionId, itemId, description) {
    return await this.fileService.updateItemDescription(sessionId, itemId, description);
  }

  async updateSessionEmail(sessionId, email) {
    await this.customerRepo.updateCustomerEmail(sessionId, email);
    await this.notificationService.publishToCRM({
      crmProcess: "bulkAppraisalEmailUpdate",
      customer: { email },
      metadata: {
        origin: "payment-processor",
        sessionId,
        environment: process.env.NODE_ENV || 'production',
        timestamp: Math.floor(Date.now() / 1000)
      }
    });
    return true;
  }

  async publishFinalizationMessage(sessionId, appraisalType, sessionStatus) {
    const customerInfo = await this.customerRepo.getCustomerInfo(sessionId);
    await this.notificationService.publishFinalizationMessage(
      sessionId,
      appraisalType,
      sessionStatus,
      customerInfo
    );
  }

  async finalizeSession(sessionId, appraisalType) {
    const sessionStatus = await this.getSessionStatus(sessionId);
    
    if (!sessionStatus.session.items.length) {
      throw new Error('No files uploaded in this session');
    }

    // Get the appropriate payment link based on appraisal type
    const paymentLinkId = Object.entries(this.config.PAYMENT_LINKS)
      .find(([_, value]) => value.productName.toLowerCase() === appraisalType.toLowerCase())?.[0];

    if (!paymentLinkId) {
      throw new Error(`Invalid appraisal type: ${appraisalType}`);
    }

    // Return the payment link URL
    return {
      checkout_url: `https://buy.stripe.com/${paymentLinkId}`
    };
  }

  async getSessionStatus(sessionId) {
    return await this.sessionService.getSessionStatus(sessionId);
  }
}

module.exports = BulkAppraisalService;