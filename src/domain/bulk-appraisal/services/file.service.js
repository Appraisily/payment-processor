const { optimizeImage } = require('../../../infrastructure/image/processor');

class FileService {
  constructor(config, repositories) {
    this.config = config;
    this.repositories = repositories;
  }

  async uploadFile(sessionId, file, metadata) {
    try {
      // Optimize image before upload
      const optimizedBuffer = await optimizeImage(file.buffer);
      file.buffer = optimizedBuffer;

      return await this.repositories.storage.uploadFile(sessionId, file, metadata);
    } catch (error) {
      console.error('Error uploading file:', error);
      throw error;
    }
  }

  async deleteFile(sessionId, fileId) {
    return await this.repositories.storage.deleteFile(sessionId, fileId);
  }

  async updateItemDescription(sessionId, itemId, description) {
    return await this.repositories.storage.updateItemDescription(sessionId, itemId, description);
  }
}

module.exports = FileService;