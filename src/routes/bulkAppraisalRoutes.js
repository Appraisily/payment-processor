const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { Storage } = require('@google-cloud/storage');
const { logError } = require('../utils/error/logger');

function setupBulkAppraisalRoutes(app, config) {
  const router = express.Router();
  const storage = new Storage({
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID
  });

  router.post('/init', async (req, res) => {
    try {
      // Generate session ID
      const session_id = `bulk_${uuidv4()}`;
      
      // Calculate expiration date (24h from now)
      const expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      // Send immediate response
      res.status(200).json({
        success: true,
        session_id,
        expires_at
      });

      // Create GCS folder in background
      const bucket = storage.bucket(config.GCS_BULK_APPRAISAL_BUCKET);
      try {
        // Create an empty file to represent the folder
        const folderFile = bucket.file(`${session_id}/.folder`);
        await folderFile.save('');
        
        console.log('Created GCS folder for bulk session:', {
          session_id,
          bucket: config.GCS_BULK_APPRAISAL_BUCKET,
          expires_at
        });
      } catch (error) {
        console.error('Error creating GCS folder:', error);
        await logError(config, {
          severity: 'Error',
          scriptName: 'bulkAppraisalRoutes',
          errorCode: 'GCS_FOLDER_CREATION_ERROR',
          errorMessage: error.message,
          stackTrace: error.stack,
          additionalContext: JSON.stringify({ 
            session_id,
            bucket: config.GCS_BULK_APPRAISAL_BUCKET
          })
        });
      }
    } catch (error) {
      console.error('Error initializing bulk session:', error);
      await logError(config, {
        severity: 'Error',
        scriptName: 'bulkAppraisalRoutes',
        errorCode: 'BULK_SESSION_INIT_ERROR',
        errorMessage: error.message,
        stackTrace: error.stack
      });
      
      // Only send error response if we haven't sent the success response yet
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: 'Failed to initialize bulk session'
        });
      }
    }
  });

  app.use('/api/bulk-appraisals', router);
}

module.exports = setupBulkAppraisalRoutes;