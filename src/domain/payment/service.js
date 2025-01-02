const { validatePaymentSession } = require('./validator');
const PaymentRepository = require('./repository');
const { logError } = require('../../utils/error/logger');

class PaymentService {
  constructor(config) {
    this.config = config;
    this.repository = new PaymentRepository(config);
  }

  async processCheckoutSession(session, mode) {
    try {
      // Validate session
      const validationError = validatePaymentSession(session);
      if (validationError) {
        throw new Error(validationError);
      }

      // Check for duplicate session
      const isDuplicate = await this.repository.isDuplicateSession(session.id);
      if (isDuplicate) {
        console.log(`Duplicate session ID detected: ${session.id}`);
        return;
      }

      // Process payment record
      await this.repository.recordPayment(session, mode);

      // Record pending appraisal
      await this.repository.recordPendingAppraisal(session);

      // Send confirmation email
      await this.repository.sendConfirmationEmail(session);

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
}

module.exports = PaymentService;