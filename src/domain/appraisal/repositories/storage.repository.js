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

    try {
      return await this.gcsClient.backupFiles(images, metadata);
    } catch (error) {
      console.error('Failed to backup files:', error);
      return null;
    }
  }
}

module.exports = StorageRepository;