const { Storage } = require('@google-cloud/storage');
const { logError } = require('../../utils/error/logger');

class GCSClient {
  constructor(config) {
    this.config = config;
    this.storage = new Storage({
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID
    });
    this.bucket = this.storage.bucket(config.GCS_BUCKET_NAME);
    this.baseUrl = `https://storage.googleapis.com/${config.GCS_BUCKET_NAME}`;
  }

  async uploadFile(buffer, filename, metadata = {}) {
    try {
      const file = this.bucket.file(filename);
      const stream = file.createWriteStream({
        resumable: false,
        metadata: {
          contentType: metadata.contentType || 'application/octet-stream',
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

      return `${this.baseUrl}/${filename}`;
    } catch (error) {
      console.error('GCS upload error:', error);
      throw error;
    }
  }

  getFolderUrl(sessionId) {
    return `${this.baseUrl}/${sessionId}/`;
  }

  async backupFiles(files, metadata = {}) {
    console.log('Starting GCS backup for files:', {
      session_id: metadata.session_id,
      fileTypes: Object.keys(files),
      hasMetadata: !!metadata
    });
    const results = {};
    const timestamp = Date.now();

    // Save request JSON first
    try {
      console.log('Backing up request data to GCS');
      const requestData = {
        ...metadata,
        timestamp: new Date().toISOString()
      };
      const jsonFilename = `${metadata.session_id}/request-data.json`;
      results.requestData = await this.uploadFile(
        Buffer.from(JSON.stringify(requestData, null, 2)),
        jsonFilename,
        {
          contentType: 'application/json',
          ...metadata
        }
      );
      console.log('Successfully backed up request data to GCS:', results.requestData);
    } catch (error) {
      console.error('Failed to backup request data:', error);
      results.requestData = null;
      await logError(this.config, {
        severity: 'Warning',
        scriptName: 'GCSClient',
        errorCode: 'REQUEST_DATA_BACKUP_ERROR',
        errorMessage: error.message,
        stackTrace: error.stack,
        additionalContext: JSON.stringify({
          session_id: metadata.session_id
        })
      });
    }

    for (const [key, fileArray] of Object.entries(files)) {
      if (fileArray && fileArray[0]) {
        try {
          console.log(`Backing up ${key} file to GCS`);
          const filename = `${metadata.session_id}/${key}-${timestamp}.jpg`;
          results[key] = await this.uploadFile(
            fileArray[0].buffer,
            filename,
            {
              contentType: 'image/jpeg',
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
    
    // Set folder URL (with trailing slash to indicate directory)
    results.folderUrl = this.getFolderUrl(metadata.session_id);
    
    return results;
  }
}

module.exports = GCSClient;