const { Storage } = require('@google-cloud/storage');

class CustomerRepository {
  constructor(config) {
    this.config = config;
    this.storage = new Storage({
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID
    });
    this.bucket = this.storage.bucket(config.GCS_BULK_APPRAISAL_BUCKET);
  }

  async getCustomerInfo(sessionId) {
    const customerInfoFile = this.bucket.file(`${sessionId}/customer_info.json`);
    try {
      const [content] = await customerInfoFile.download();
      return JSON.parse(content.toString());
    } catch (error) {
      return {};
    }
  }

  async updateCustomerEmail(sessionId, email) {
    const customerInfo = await this.getCustomerInfo(sessionId);
    const customerInfoFile = this.bucket.file(`${sessionId}/customer_info.json`);

    const updatedInfo = {
      ...customerInfo,
      email,
      updated_at: new Date().toISOString()
    };

    await customerInfoFile.save(JSON.stringify(updatedInfo, null, 2));
    return true;
  }

  async updateFinalizationInfo(sessionId, info) {
    const customerInfo = await this.getCustomerInfo(sessionId);
    const customerInfoFile = this.bucket.file(`${sessionId}/customer_info.json`);

    const updatedInfo = {
      ...customerInfo,
      ...info,
      finalized_at: new Date().toISOString(),
      status: 'finalized'
    };

    await customerInfoFile.save(JSON.stringify(updatedInfo, null, 2));
    return updatedInfo;
  }
}

module.exports = CustomerRepository;