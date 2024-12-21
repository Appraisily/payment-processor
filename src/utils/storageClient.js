const { Storage } = require('@google-cloud/storage');
const { logError } = require('./errorLogger');

const storage = new Storage({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID
});

/**
 * Uploads a file to Google Cloud Storage without blocking
 * 
 * @param {Buffer} buffer - File buffer to upload
 * @param {string} filename - Name for the file in GCS
 * @param {Object} config - Application configuration
 * @param {Object} metadata - Additional metadata for the file
 * @returns {Promise<string>} - GCS signed URL of the uploaded file
 */
async function uploadToGCS(buffer, filename, config, metadata = {}) {
  try {
    let bucket = storage.bucket(config.GCS_BUCKET_NAME);

    // Create write stream with metadata
    const file = bucket.file(filename);
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

    // Handle upload completion
    const uploadResult = await new Promise((resolve, reject) => {
      stream.on('finish', resolve);
      stream.on('error', reject);
      stream.end(buffer);
    });

    console.log(`File ${filename} uploaded successfully`);

    // Return the public URL instead of a signed URL
    return `https://storage.googleapis.com/${config.GCS_BUCKET_NAME}/${filename}`;

  } catch (error) {
    console.error('GCS upload error:', {
      message: error.message,
      code: error.code,
      details: error.details,
      bucket: config.GCS_BUCKET_NAME,
      filename
    });

    await logError(config, {
      severity: 'Warning',
      scriptName: 'storageClient',
      errorCode: 'GCS_UPLOAD_ERROR',
      errorMessage: error.message,
      stackTrace: error.stack,
      additionalContext: JSON.stringify({ 
        error: error.message,
        code: error.code,
        bucket: config.GCS_BUCKET_NAME,
        filename,
        metadata
      })
    });

    return null;
  }
}

/**
 * Backup multiple files to GCS in parallel
 * 
 * @param {Object} files - Object containing file buffers
 * @param {Object} config - Application configuration
 * @param {Object} metadata - Common metadata for all files
 * @returns {Promise<Object>} - Object with GCS URLs for each file
 */
async function backupFiles(files, config, metadata = {}) {
  const backupPromises = {};
  const timestamp = Date.now();
  const results = {};

  // Start all uploads in parallel
  for (const [key, fileArray] of Object.entries(files)) {
    if (fileArray && fileArray[0]) {
      try {
        const filename = `${metadata.session_id}/${key}-${timestamp}.jpg`;
        const url = await uploadToGCS(
          fileArray[0].buffer,
          filename,
          config,
          {
            ...metadata,
            fileType: key
          }
        );
        
        results[key] = url;
        console.log(`Backup successful for ${key}:`, url);
      } catch (error) {
        console.error(`Failed to backup ${key}:`, error);
        results[key] = null;
        
        await logError(config, {
          severity: 'Warning',
          scriptName: 'storageClient',
          errorCode: 'FILE_BACKUP_ERROR',
          errorMessage: `Failed to backup ${key}: ${error.message}`,
          stackTrace: error.stack,
          additionalContext: JSON.stringify({
            key,
            session_id: metadata.session_id,
            error: error.message
          })
        });
      }
    }
  }

  console.log('Backup results:', results);
  return results;
}

module.exports = {
  backupFiles
};