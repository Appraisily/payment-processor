const StorageRepository = require('../repositories/storage.repository');

class FileService {
  constructor(config) {
    this.config = config;
    this.storageRepo = new StorageRepository(config);
  }

  async uploadFile(sessionId, file, metadata) {
    return await this.storageRepo.uploadFile(sessionId, file, metadata);
  }

  async deleteFile(sessionId, fileId) {
    return await this.storageRepo.deleteFile(sessionId, fileId);
  }

  async updateItemDescription(sessionId, itemId, description) {
    return await this.storageRepo.updateItemDescription(sessionId, itemId, description);
  }
}

module.exports = FileService;