const { Storage } = require('@google-cloud/storage');
const { logError } = require('../../utils/error/logger');

class GCSClient {
  constructor(config) {
    this.config = config;
    this.storage = new Storage({
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID
    });
    this.bucket = this.storage.bucket(config.GCS_BUCKET_NAME);
  }

  async uploadFile(buffer, filename, metadata = {}) {
    try {
      const file = this.bucket.file(filename);
      const stream = file.createWriteStream({
        resumable: false,
        metadata: {
          contentType: 'image/jpeg',
          metadata: {
            ...metadata,
            uploadedAt: new Date().toISOString()
          }
        }
      });

      await new Promise((resolve, reject) => {
        stream.on('finish', resolve);
        stream.on('error', reject);
        stream.end(buffer);
      });

      return `https://storage.googleapis.com/${this.config.GCS_BUCKET_NAME}/${filename}`;
    } catch (error) {
      console.error('GCS upload error:', error);
      throw error;
    }
  }

  async backupFiles(files, metadata = {}) {
    console.log('Starting GCS backup for files:', {
      session_id: metadata.session_id,
      fileTypes: Object.keys(files)
    });
    const results = {};
    const timestamp = Date.now();

    for (const [key, fileArray] of Object.entries(files)) {
      if (fileArray && fileArray[0]) {
        try {
          console.log(`Backing up ${key} file to GCS`);
          const filename = `${metadata.session_id}/${key}-${timestamp}.jpg`;
          results[key] = await this.uploadFile(
            fileArray[0].buffer,
            filename,
            {
              ...metadata,
              fileType: key
            }
          );
          console.log(`Successfully backed up ${key} file to GCS:`, results[key]);
        } catch (error) {
          console.error(`Failed to backup ${key}:`, error);
          results[key] = null;
          await logError(this.config, {
            severity: 'Warning',
            scriptName: 'GCSClient',
            errorCode: 'FILE_BACKUP_ERROR',
            errorMessage: error.message,
            stackTrace: error.stack,
            additionalContext: JSON.stringify({
              key,
              session_id: metadata.session_id
            })
          });
        }
      }
    }

    console.log('GCS backup completed:', {
      session_id: metadata.session_id,
      backedUpFiles: Object.keys(results)
    });
    return results;
  }
}

module.exports = GCSClient;