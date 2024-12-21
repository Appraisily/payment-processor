# Payment Processor Service

A Node.js service that handles Stripe payments, records transactions, manages art appraisal workflows, and integrates with WordPress for content management. Built following modular design principles and best practices.

## Features

- **Payment Processing**: Handles Stripe webhook events for completed checkout sessions
- **Data Management**: Records transactions in Google Sheets
- **WordPress Integration**: Creates and updates appraisal posts with media
- **Image Processing**: Optimizes and stores images in both WordPress and Google Cloud Storage
- **Email Notifications**: Sends automated emails using SendGrid
- **Error Logging**: Comprehensive error tracking in Google Sheets
- **Security**: Proper secret management and authentication

## Architecture

### Core Components

1. **Payment Processing**
   - Stripe webhook handling
   - Payment verification
   - Transaction recording

2. **Appraisal Management**
   - Image processing and optimization
   - WordPress post creation
   - Google Cloud Storage backup
   - Spreadsheet updates

3. **Communication**
   - Email notifications
   - Error logging
   - Status updates

### Data Flow

1. **Payment Received**
   - Stripe webhook triggered
   - Payment verified
   - Transaction recorded in Sales sheet
   - Entry added to Pending Appraisals sheet

2. **Appraisal Submission**
   - Images received and processed
   - WordPress post created
   - Images uploaded to WordPress
   - Backup copies stored in GCS
   - Spreadsheet updated with WordPress URL
   - Email notifications sent

## Code Organization

```
├── src/
│   ├── index.js                    # Application entry point
│   ├── config.js                   # Configuration management
│   ├── routes/
│   │   ├── webhookRoutes.js       # Stripe webhook endpoints
│   │   ├── stripeRoutes.js        # Stripe API endpoints
│   │   └── appraisalRoutes.js     # Appraisal submission handling
│   ├── services/
│   │   ├── webhookHandler.js      # Webhook processing
│   │   ├── checkoutProcessor.js   # Checkout session handling
│   │   ├── backgroundProcessor.js  # Async processing
│   │   └── appraisalProcessor.js  # Appraisal processing
│   └── utils/
│       ├── errorLogger.js         # Error logging
│       ├── emailService.js        # Email handling
│       ├── imageProcessor.js      # Image optimization
│       ├── spreadsheetClient.js   # Google Sheets operations
│       ├── storageClient.js       # GCS operations
│       ├── validators.js          # Input validation
│       └── wordPressClient.js     # WordPress API integration
```

## Google Sheets Structure

### Sales Sheet
Columns:
- A: Session ID
- B: Payment Intent ID
- C: Customer ID
- D: Customer Name
- E: Customer Email
- F: Amount Paid
- G: Session Date
- H: Mode (Test/Live)

### Pending Appraisals Sheet
Columns:
- A: Date
- B: Appraisal Type
- C: Session ID
- D: Customer Email
- E: Customer Name
- F: Status
- G: WordPress Edit URL

### Error Log Sheet
Columns:
- Timestamp
- Severity
- Script Name
- Error Code
- Error Message
- Stack Trace
- User ID
- Request ID
- Environment
- Endpoint
- Additional Context
- Resolution Status
- Assigned To
- ChatGPT Link
- Resolution Link

## Required Secrets

Configure these secrets in Google Cloud Secret Manager:

```
STRIPE_SECRET_KEY_TEST            # Stripe test API key
STRIPE_SECRET_KEY_LIVE           # Stripe live API key
STRIPE_WEBHOOK_SECRET_TEST       # Stripe test webhook secret
STRIPE_WEBHOOK_SECRET_LIVE       # Stripe live webhook secret
STRIPE_SHARED_SECRET            # API authentication secret
SALES_SPREADSHEET_ID            # Sales sheet ID
PENDING_APPRAISALS_SPREADSHEET_ID # Pending appraisals sheet ID
LOG_SPREADSHEET_ID              # Error log sheet ID
SENDGRID_API_KEY               # SendGrid API key
SENDGRID_EMAIL                 # Verified sender email
SEND_GRID_TEMPLATE_NOTIFY_PAYMENT_RECEIVED # SendGrid template ID
WORDPRESS_API_URL              # WordPress REST API endpoint
wp_username                    # WordPress username
wp_app_password               # WordPress application password
ADMIN_EMAIL                   # Admin notification email
SHARED_SECRET                 # Backend communication secret
```

## Environment Variables

Optional configuration:
```
PORT                    # Server port (default: 8080)
GOOGLE_CLOUD_PROJECT_ID # Google Cloud project ID
CHATGPT_CHAT_URL       # Support chat URL
RESOLUTION_LINK        # Issue resolution link
ASSIGNED_TO            # Default assignee
GCS_BUCKET_NAME        # GCS bucket for image backups
```

## API Endpoints

### Stripe Webhooks

#### POST `/stripe-webhook`
Handles live mode webhook events.

#### POST `/stripe-webhook-test`
Handles test mode webhook events.

### Stripe API

#### GET `/stripe/session/:sessionId`
Retrieves session information.

Headers:
- `x-shared-secret`: Authentication token

### Appraisal Submission

#### POST `/api/appraisals`
Handles appraisal submissions with images.

Content-Type: `multipart/form-data`

Fields:
- `session_id`: Stripe session ID
- `description`: (optional) Appraisal description
- `main`: Main image file
- `signature`: (optional) Signature image
- `age`: (optional) Age verification image

## Required IAM Permissions

The service account needs these permissions:

```bash
# Google Sheets API
roles/sheets.editor

# Secret Manager
roles/secretmanager.secretAccessor

# Cloud Storage
roles/storage.objectViewer
roles/storage.objectCreator
```

## Running the Service

```bash
# Install dependencies
npm install

# Start the service
npm start
```

## Docker Deployment

```bash
# Build the container
docker build -t payment-processor .

# Run the container
docker run -p 8080:8080 payment-processor
```

## Error Handling

The service implements comprehensive error handling:

1. **Validation Errors**: Input validation for all requests
2. **Processing Errors**: Handled gracefully with proper logging
3. **Integration Errors**: Managed with retries where appropriate
4. **Security Errors**: Properly logged and handled
5. **Network Errors**: Timeout handling and retry logic

## Security Measures

1. **Authentication**:
   - Stripe webhook signature verification
   - Shared secret for API endpoints
   - WordPress basic authentication

2. **Data Protection**:
   - Secure secret management
   - HTTPS enforcement
   - Input validation
   - CORS protection

3. **Error Handling**:
   - Secure error logging
   - No sensitive data in responses
   - Proper status codes

## Monitoring and Logging

1. **Error Logging**:
   - Centralized logging in Google Sheets
   - Severity levels
   - Stack traces
   - Context preservation

2. **Transaction Tracking**:
   - Payment records
   - Processing status
   - Audit trail

3. **Status Monitoring**:
   - Health check endpoint
   - Process tracking
   - Error rate monitoring

## Best Practices

1. **Code Organization**:
   - Modular design
   - Single responsibility
   - Clear dependencies
   - Proper error handling

2. **Security**:
   - Input validation
   - Proper authentication
   - Secure configurations
   - Error handling

3. **Performance**:
   - Async operations
   - Proper caching
   - Optimized database queries
   - Resource management

4. **Maintenance**:
   - Clear documentation
   - Consistent coding style
   - Error logging
   - Version control