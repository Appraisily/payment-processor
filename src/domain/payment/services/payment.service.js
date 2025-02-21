const { logError } = require('../../../utils/error/logger');

class PaymentService {
  constructor(config, repositories) {
    this.config = config;
    this.repositories = repositories;
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
    // Record payment
    await this.repositories.sheets.recordPayment(session, mode);
    
    // Record in pending appraisals with bulk info
    await this.repositories.sheets.recordPendingAppraisal(session, true);
    
    // Send bulk confirmation email
    await this.repositories.email.sendBulkConfirmationEmail(session);
    
    // Publish to CRM
    await this.repositories.pubsub.publishPaymentEvent(session, mode, true);
  }

  async processRegularOrder(session, mode) {
    // Check for duplicate session
    const isDuplicate = await this.repositories.sheets.isDuplicateSession(session.id);
    if (isDuplicate) {
      console.log(`Duplicate session ID detected: ${session.id}`);
      return;
    }

    // Record payment
    await this.repositories.sheets.recordPayment(session, mode);

    // Record pending appraisal
    await this.repositories.sheets.recordPendingAppraisal(session, false);

    // Send confirmation email
    await this.repositories.email.sendConfirmationEmail(session);

    // Publish to CRM
    await this.repositories.pubsub.publishPaymentEvent(session, mode, false);
  }
}

module.exports = PaymentService;