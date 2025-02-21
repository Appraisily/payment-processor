const { validatePaymentSession } = require('./validator');
const SheetsRepository = require('./repositories/sheets.repository');
const EmailRepository = require('./repositories/email.repository');
const PubSubRepository = require('./repositories/pubsub.repository');
const { logError } = require('../../utils/error/logger');

class PaymentService {
  constructor(config) {
    this.config = config;
    this.sheetsRepo = new SheetsRepository(config);
    this.emailRepo = new EmailRepository(config);
    this.pubsubRepo = new PubSubRepository(config);
  }

  async processCheckoutSession(session, mode) {
    try {
      // Check if this is a bulk order
      const isBulkOrder = session.client_reference_id?.startsWith('bulk_');

      if (isBulkOrder) {
        console.log('Processing bulk order:', {
          session_id: session.id,
          bulk_session_id: session.client_reference_id,
          customer_email: session.customer_details?.email
        });

        await this.processBulkOrder(session, mode);
        return;
      }

      await this.processRegularOrder(session, mode);
    } catch (error) {
      await logError(this.config, {
        severity: 'Error',
        scriptName: 'PaymentService',
        errorCode: 'PAYMENT_PROCESSING_ERROR',
        errorMessage: error.message,
        stackTrace: error.stack,
        additionalContext: JSON.stringify({ 
          session_id: session.id,
          mode 
        })
      });
      throw error;
    }
  }

  async processBulkOrder(session, mode) {
    // Record payment in Sales sheet
    await this.sheetsRepo.recordPayment(session, mode);
    
    // Record in pending appraisals with bulk info
    await this.sheetsRepo.recordPendingAppraisal(session, true);
    
    // Send bulk confirmation email
    await this.emailRepo.sendBulkConfirmationEmail(session);
    
    // Publish to CRM
    await this.pubsubRepo.publishPaymentEvent(session, mode, true);
  }

  async processRegularOrder(session, mode) {
    // Validate session
    const validationError = validatePaymentSession(session);
    if (validationError) {
      throw new Error(validationError);
    }

    // Check for duplicate session
    const isDuplicate = await this.sheetsRepo.isDuplicateSession(session.id);
    if (isDuplicate) {
      console.log(`Duplicate session ID detected: ${session.id}`);
      return;
    }

    // Record payment
    await this.sheetsRepo.recordPayment(session, mode);

    // Record pending appraisal
    await this.sheetsRepo.recordPendingAppraisal(session, false);

    // Send confirmation email
    await this.emailRepo.sendConfirmationEmail(session);

    // Publish to CRM
    await this.pubsubRepo.publishPaymentEvent(session, mode, false);
  }
}

module.exports = PaymentService;