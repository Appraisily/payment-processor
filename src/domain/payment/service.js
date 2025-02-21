const { validatePaymentSession } = require('./validator');
const PaymentRepository = require('./repository');
const { logError } = require('../../utils/error/logger');
const BulkAppraisalService = require('../bulk-appraisal/service');

class PaymentService {
  constructor(config) {
    this.config = config;
    this.repository = new PaymentRepository(config);
    this.bulkAppraisalService = new BulkAppraisalService(config);
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
        
        // Get session status to verify files and metadata
        const sessionStatus = await this.bulkAppraisalService.getSessionStatus(
          session.client_reference_id.replace('bulk_', '')
        );
        
        // Record payment but skip regular appraisal processing
        await this.repository.recordPayment(session, mode);
        
        // Publish finalization message
        await this.bulkAppraisalService.publishFinalizationMessage(
          session.client_reference_id.replace('bulk_', ''),
          session.metadata?.appraisal_type || 'regular',
          sessionStatus
        );
        
        return;
      }

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