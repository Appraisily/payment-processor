const { Storage } = require('@google-cloud/storage');
const { v4: uuidv4 } = require('uuid');

class StorageRepository {
  constructor(config) {
    this.config = config;
    this.storage = new Storage({
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID
    });
    this.bucket = this.storage.bucket(config.GCS_BULK_APPRAISAL_BUCKET);
  }

  async createSessionFolder(sessionId) {
    const folderFile = this.bucket.file(`${sessionId}/.folder`);
    await folderFile.save('');
    console.log('Created GCS folder for bulk session:', { session_id: sessionId });
  }

  async uploadFile(sessionId, file, metadata) {
    const file_id = uuidv4();
    const filePath = `${sessionId}/${String(metadata.position).padStart(4, '0')}_${file_id}.jpg`;
    const gcsFile = this.bucket.file(filePath);

    await gcsFile.save(file.buffer, {
      metadata: {
        contentType: 'image/jpeg',
        metadata: {
          description: metadata.description || '',
          category: metadata.category || 'uncategorized',
          position: metadata.position.toString(),
          originalName: file.originalname,
          uploadTime: new Date().toISOString()
        }
      }
    });

    const [url] = await gcsFile.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 60 * 60 * 1000
    });

    return { file_id, url };
  }

  async deleteFile(sessionId, fileId) {
    const [files] = await this.bucket.getFiles({ prefix: `${sessionId}/` });
    const fileToDelete = files.find(file => file.name.includes(`_${fileId}.jpg`));
    
    if (!fileToDelete) {
      throw new Error('File not found');
    }

    await fileToDelete.delete();
    return true;
  }

  async updateItemDescription(sessionId, itemId, description) {
    const [files] = await this.bucket.getFiles({ prefix: `${sessionId}/` });
    const fileToUpdate = files.find(file => file.name.includes(`_${itemId}.jpg`));

    if (!fileToUpdate) {
      throw new Error('Session or item not found');
    }

    const [metadata] = await fileToUpdate.getMetadata();
    await fileToUpdate.setMetadata({
      metadata: {
        ...metadata.metadata,
        description,
        updated_at: new Date().toISOString()
      }
    });

    return true;
  }

  async getSessionFiles(sessionId) {
    const [files] = await this.bucket.getFiles({ prefix: `${sessionId}/` });
    return Promise.all(
      files
        .filter(file => !file.name.endsWith('.folder') && !file.name.endsWith('customer_info.json'))
        .map(async (file) => {
          const [metadata] = await file.getMetadata();
          const [url] = await file.getSignedUrl({
            version: 'v4',
            action: 'read',
            expires: Date.now() + 60 * 60 * 1000
          });

          const fileId = file.name.split('_')[1]?.replace('.jpg', '');
          
          return {
            id: fileId,
            file_url: url,
            description: metadata.metadata.description || '',
            category: metadata.metadata.category || 'uncategorized',
            status: 'processed'
          };
        })
    );
  }

  async getSessionTimes(sessionId) {
    const [files] = await this.bucket.getFiles({ prefix: `${sessionId}/` });
    const folderFile = files.find(file => file.name.endsWith('.folder'));
    const sessionCreationTime = folderFile ? new Date(folderFile.metadata.timeCreated) : new Date();
    
    return {
      created_at: sessionCreationTime.toISOString(),
      expires_at: new Date(sessionCreationTime.getTime() + 24 * 60 * 60 * 1000).toISOString()
    };
  }
}