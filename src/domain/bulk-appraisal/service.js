const { Storage } = require('@google-cloud/storage');
const { v4: uuidv4 } = require('uuid');
const { PubSub } = require('@google-cloud/pubsub');
const { logError } = require('../../utils/error/logger');

class BulkAppraisalService {
  constructor(config) {
    this.config = config;
    this.storage = new Storage({
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID
    });
    this.pubsub = new PubSub();
  }

  async initializeSession() {
    const session_id = `bulk_${uuidv4()}`;
    const expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    try {
      const bucket = this.storage.bucket(this.config.GCS_BULK_APPRAISAL_BUCKET);
      const folderFile = bucket.file(`${session_id}/.folder`);
      await folderFile.save('');

      console.log('Created GCS folder for bulk session:', {
        session_id,
        bucket: this.config.GCS_BULK_APPRAISAL_BUCKET,
        expires_at
      });

      return { session_id, expires_at };
    } catch (error) {
      console.error('Error creating GCS folder:', error);
      await logError(this.config, {
        severity: 'Error',
        scriptName: 'BulkAppraisalService',
        errorCode: 'GCS_FOLDER_CREATION_ERROR',
        errorMessage: error.message,
        stackTrace: error.stack,
        additionalContext: JSON.stringify({ 
          session_id,
          bucket: this.config.GCS_BULK_APPRAISAL_BUCKET
        })
      });
      throw error;
    }
  }

  async uploadFile(sessionId, file, metadata) {
    const file_id = uuidv4();
    const filePath = `${sessionId}/${String(metadata.position).padStart(4, '0')}_${file_id}.jpg`;
    
    try {
      const bucket = this.storage.bucket(this.config.GCS_BULK_APPRAISAL_BUCKET);
      const gcsFile = bucket.file(filePath);

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
    } catch (error) {
      console.error('Error uploading file:', error);
      throw error;
    }
  }

  async deleteFile(sessionId, fileId) {
    try {
      const bucket = this.storage.bucket(this.config.GCS_BULK_APPRAISAL_BUCKET);
      const [files] = await bucket.getFiles({
        prefix: `${sessionId}/`
      });

      const fileToDelete = files.find(file => file.name.includes(`_${fileId}.jpg`));
      
      if (!fileToDelete) {
        throw new Error('File not found');
      }

      await fileToDelete.delete();

      console.log('File deleted successfully:', {
        session_id: sessionId,
        file_id: fileId,
        file_path: fileToDelete.name
      });

      return true;
    } catch (error) {
      console.error('Error deleting file:', error);
      throw error;
    }
  }

  async updateItemDescription(sessionId, itemId, description) {
    try {
      const bucket = this.storage.bucket(this.config.GCS_BULK_APPRAISAL_BUCKET);
      
      // Find the file
      const [files] = await bucket.getFiles({
        prefix: `${sessionId}/`
      });

      const fileToUpdate = files.find(file => 
        file.name.includes(`_${itemId}.jpg`)
      );

      if (!fileToUpdate) {
        throw new Error('Session or item not found');
      }

      // Get current metadata
      const [metadata] = await fileToUpdate.getMetadata();
      
      // Update metadata with new description
      await fileToUpdate.setMetadata({
        metadata: {
          ...metadata.metadata,
          description: description,
          updated_at: new Date().toISOString()
        }
      });

      console.log('Item description updated:', {
        session_id: sessionId,
        item_id: itemId,
        description_length: description.length
      });

      return true;
    } catch (error) {
      console.error('Error updating item description:', error);
      throw error;
    }
  }

  async publishToCRM(message) {
    try {
      const topicName = process.env.PUBSUB_CRM_NAME;
      if (!topicName) {
        console.error('PUBSUB_CRM_NAME environment variable not set');
        return;
      }

      const topic = this.pubsub.topic(topicName);
      const messageBuffer = Buffer.from(JSON.stringify(message));
      
      const messageId = await topic.publish(messageBuffer);
      console.log(`Message ${messageId} published to CRM topic`);
    } catch (error) {
      console.error('Error publishing to CRM PubSub:', error);
      // Don't throw error to avoid interrupting the main flow
    }
  }

  async updateSessionEmail(sessionId, email) {
    try {
      const bucket = this.storage.bucket(this.config.GCS_BULK_APPRAISAL_BUCKET);
      
      // Check if session exists
      const [files] = await bucket.getFiles({
        prefix: `${sessionId}/`
      });

      if (!files.length) {
        throw new Error('Session not found');
      }

      // Get or create customer info file
      const customerInfoFile = bucket.file(`${sessionId}/customer_info.json`);
      let customerInfo = {};

      try {
        const [content] = await customerInfoFile.download();
        customerInfo = JSON.parse(content.toString());
      } catch (error) {
        // File doesn't exist yet, which is fine
        console.log('No existing customer info file found');
      }

      // Update email
      customerInfo.email = email;
      customerInfo.updated_at = new Date().toISOString();

      // Save updated info
      await customerInfoFile.save(JSON.stringify(customerInfo, null, 2));

      console.log('Session email updated:', {
        session_id: sessionId,
        email: email
      });

      // Publish CRM notification
      await this.publishToCRM({
        crmProcess: "bulkAppraisalEmailUpdate",
        customer: {
          email: email
        },
        metadata: {
          origin: "payment-processor",
          sessionId: sessionId,
          environment: process.env.NODE_ENV || 'production',
          timestamp: Math.floor(Date.now() / 1000)
        }
      });

      return true;
    } catch (error) {
      console.error('Error updating session email:', error);
      throw error;
    }
  }

  async finalizeSession(sessionId, customerInfo) {
    try {
      const pricePerItem = {
        regular: 2500,    // $25 per item
        insurance: 5000,  // $50 per item
        tax: 7500        // $75 per item
      };

      const appraisalTypeDescriptions = {
        regular: 'Standard art appraisal',
        insurance: 'Insurance valuation appraisal',
        tax: 'Tax documentation appraisal'
      };

      // Get session status to verify files exist
      const sessionStatus = await this.getSessionStatus(sessionId);
      
      if (!sessionStatus.files.length) {
        throw new Error('No files uploaded in this session');
      }

      // Create metadata file with customer info
      const bucket = this.storage.bucket(this.config.GCS_BULK_APPRAISAL_BUCKET);
      const metadataFile = bucket.file(`${sessionId}/customer_info.json`);
      
      await metadataFile.save(JSON.stringify({
        email: customerInfo.email || '',
        phone: customerInfo.phone || '',
        notes: customerInfo.notes || '',
        appraisal_type: customerInfo.appraisal_type,
        files_count: sessionStatus.files.length,
        finalized_at: new Date().toISOString()
      }));

      // Create Stripe checkout session
      // Publish CRM notification
      await this.publishToCRM({
        crmProcess: "bulkAppraisalFinalized",
        customer: {
          email: customerInfo.email,
          notes: customerInfo.notes || ''
        },
        appraisal: {
          type: customerInfo.appraisal_type,
          itemCount: sessionStatus.files.length,
          sessionId: sessionId
        },
        metadata: {
          origin: "payment-processor",
          environment: process.env.NODE_ENV || 'production',
          timestamp: Math.floor(Date.now() / 1000)
        }
      });

      const stripe = require('stripe')(this.config.STRIPE_SECRET_KEY_LIVE);
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${appraisalTypeDescriptions[customerInfo.appraisal_type]} - ${sessionStatus.files.length} items`,
              description: `Bulk ${customerInfo.appraisal_type} appraisal service for ${sessionStatus.files.length} items`
            },
            unit_amount: pricePerItem[customerInfo.appraisal_type] * sessionStatus.files.length
          },
          quantity: 1
        }],
        customer_email: customerInfo.email,
        metadata: {
          bulk_session_id: sessionId,
          items_count: sessionStatus.files.length.toString(),
          appraisal_type: customerInfo.appraisal_type
        },
        mode: 'payment',
        success_url: `${process.env.FRONTEND_URL || 'https://www.appraisily.com'}/bulk-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.FRONTEND_URL || 'https://www.appraisily.com'}/bulk-cancel?session_id={CHECKOUT_SESSION_ID}`
      });

      return {
        checkout_url: session.url
      };
    } catch (error) {
      console.error('Error finalizing session:', error);
      throw error;
    }
  }

  async getSessionStatus(sessionId) {
    try {
      const bucket = this.storage.bucket(this.config.GCS_BULK_APPRAISAL_BUCKET);
      
      // Get all files in the session folder
      const [files] = await bucket.getFiles({
        prefix: `${sessionId}/`
      });

      // Get customer info and appraisal type if they exist
      let customerEmail, appraisalType;
      const customerInfoFile = files.find(file => file.name.endsWith('customer_info.json'));
      if (customerInfoFile) {
        const [content] = await customerInfoFile.download();
        const customerInfo = JSON.parse(content.toString());
        customerEmail = customerInfo.email;
        appraisalType = customerInfo.appraisal_type;
      }

      // Process image files
      const filesList = await Promise.all(files
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
        }));

      const folderFile = files.find(file => file.name.endsWith('.folder'));
      const sessionCreationTime = folderFile ? new Date(folderFile.metadata.timeCreated) : new Date();
      const expires_at = new Date(sessionCreationTime.getTime() + 24 * 60 * 60 * 1000).toISOString();
      const created_at = sessionCreationTime.toISOString();

      return {
        session: {
          id: sessionId,
          customer_email: customerEmail,
          appraisal_type: appraisalType || null,
          created_at,
          expires_at,
          items: filesList
        }
      };
    } catch (error) {
      console.error('Error retrieving session status:', error);
      throw error;
    }
  }
}

module.exports = BulkAppraisalService;