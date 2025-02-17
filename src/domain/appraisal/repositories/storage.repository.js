const GCSClient = require('../../../infrastructure/storage/gcs');

class StorageRepository {
  constructor(config) {
    this.config = config;
    this.gcsClient = new GCSClient(config);
  }

  async backupFiles(images, metadata) {
    if (!images?.main) {
      return null;
    }

    // Enhance metadata with all available information
    const enhancedMetadata = {
      ...metadata,
      timestamp: new Date().toISOString(),
      description: metadata.description || '',
      payment_id: metadata.payment_id || '',
      file_count: Object.keys(images).length,
      file_types: Object.keys(images).join(','),
      backup_type: 'customer_submission'
    };

    console.log('Starting GCS backup with metadata:', {
      session_id: enhancedMetadata.session_id,
      customer_email: enhancedMetadata.customer_email,
      file_types: enhancedMetadata.file_types,
      timestamp: enhancedMetadata.timestamp
    });

    try {
      return await this.gcsClient.backupFiles(images, enhancedMetadata);
    } catch (error) {
      console.error('Failed to backup files:', error);
      return null;
    }
  }
}

module.exports = StorageRepository;