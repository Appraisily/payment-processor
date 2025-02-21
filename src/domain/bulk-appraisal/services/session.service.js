const { v4: uuidv4 } = require('uuid');
const { logError } = require('../../../utils/error/logger');
const StorageRepository = require('../repositories/storage.repository');
const CustomerRepository = require('../repositories/customer.repository');

class SessionService {
  constructor(config) {
    this.config = config;
    this.storageRepo = new StorageRepository(config);
    this.customerRepo = new CustomerRepository(config);
  }

  async initializeSession() {
    const session_id = uuidv4();
    const expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    try {
      await this.storageRepo.createSessionFolder(`bulk_${session_id}`);
      return { session_id: `bulk_${session_id}`, expires_at };
    } catch (error) {
      await logError(this.config, {
        severity: 'Error',
        scriptName: 'SessionService',
        errorCode: 'SESSION_INIT_ERROR',
        errorMessage: error.message,
        stackTrace: error.stack,
        additionalContext: JSON.stringify({ session_id })
      });
      throw error;
    }
  }

  async getSessionStatus(sessionId) {
    try {
      const customerInfo = await this.customerRepo.getCustomerInfo(sessionId);
      const files = await this.storageRepo.getSessionFiles(sessionId);
      const { created_at, expires_at } = await this.storageRepo.getSessionTimes(sessionId);

      return {
        session: {
          id: sessionId,
          customer_email: customerInfo.email,
          appraisal_type: customerInfo.appraisal_type || null,
          created_at,
          expires_at,
          items: files
        }
      };
    } catch (error) {
      console.error('Error retrieving session status:', error);
      throw error;
    }
  }
}

module.exports = SessionService;