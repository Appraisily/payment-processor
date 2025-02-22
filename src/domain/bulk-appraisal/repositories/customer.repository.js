const { Storage } = require('@google-cloud/storage');

class CustomerRepository {
  constructor(config) {
    this.config = config;
    this.storage = new Storage({
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID
    });
    this.bucket = this.storage.bucket(config.GCS_BULK_APPRAISAL_BUCKET);
    this.validAppraisalTypes = ['Regular', 'Insurance', 'IRS'];
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
    
    // Validate and normalize appraisal type
    const normalizedType = info.appraisal_type ? 
      info.appraisal_type.charAt(0).toUpperCase() + info.appraisal_type.slice(1).toLowerCase() : 
      'Regular';
    
    if (!this.validAppraisalTypes.includes(normalizedType)) {
      throw new Error(`Invalid appraisal type. Must be one of: ${this.validAppraisalTypes.join(', ')}`);
    }

    const updatedInfo = {
      ...customerInfo,
      ...info,
      appraisal_type: normalizedType,
      images_count: info.files_count, // Rename files_count to images_count
      finalized_at: new Date().toISOString(),
      status: 'finalized'
    };

    // Remove old files_count if it exists
    delete updatedInfo.files_count;

    await customerInfoFile.save(JSON.stringify(updatedInfo, null, 2));
    return updatedInfo;
  }
}

module.exports = CustomerRepository;