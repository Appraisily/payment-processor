const { Storage } = require('@google-cloud/storage');
const { logError } = require('./errorLogger');

// Initialize storage client
const storage = new Storage();

/**
 * Uploads a file to Google Cloud Storage without blocking
 * 
 * @param {Buffer} buffer - File buffer to upload
 * @param {string} filename - Name for the file in GCS
 * @param {Object} config - Application configuration
 * @param {Object} metadata - Additional metadata for the file
 * @returns {Promise<string>} - GCS URL of the uploaded file
 */
async function uploadToGCS(buffer, filename, config, metadata = {}) {
  try {
    // Get bucket, create if doesn't exist
    let bucket = storage.bucket(config.GCS_BUCKET_NAME);
    const [exists] = await bucket.exists();
    
    if (!exists) {
      await bucket.create();
      // Set lifecycle policy - delete files after 7 days
      await bucket.setMetadata({
        lifecycle: {
          rule: [{
            action: { type: 'Delete' },
            condition: { age: 7 }
          }]
        }
      });
    }

    // Create write stream with metadata
    const file = bucket.file(filename);
    const stream = file.createWriteStream({
      metadata: {
        contentType: 'image/jpeg',
        metadata: {
          ...metadata,
          uploadedAt: new Date().toISOString()
        }
      }
    });

    // Handle upload completion
    await new Promise((resolve, reject) => {
      stream.on('finish', resolve);
      stream.on('error', reject);
      stream.end(buffer);
    });

    // Make file public and get URL
    await file.makePublic();
    return `https://storage.googleapis.com/${config.GCS_BUCKET_NAME}/${filename}`;

  } catch (error) {
    console.error('GCS upload error:', error);
    // Log error but don't throw - this is a background operation
    await logError(config, {
      severity: 'Warning',
      scriptName: 'storageClient',
      errorCode: 'GCS_UPLOAD_ERROR',
      errorMessage: error.message,
      stackTrace: error.stack,
      additionalContext: JSON.stringify({
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

  // Start all uploads in parallel
  for (const [key, fileArray] of Object.entries(files)) {
    if (fileArray && fileArray[0]) {
      const filename = `${metadata.session_id}/${key}-${timestamp}.jpg`;
      backupPromises[key] = uploadToGCS(
        fileArray[0].buffer,
        filename,
        config,
        {
          ...metadata,
          fileType: key
        }
      );
    }
  }

  // Wait for all uploads to complete
  const results = {};
  for (const [key, promise] of Object.entries(backupPromises)) {
    try {
      results[key] = await promise;
    } catch (error) {
      console.error(`Failed to backup ${key}:`, error);
      results[key] = null;
    }
  }

  return results;
}

module.exports = {
  backupFiles
};