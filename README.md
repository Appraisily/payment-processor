# Payment Processor Service

A Node.js service that handles Stripe payments, records transactions, manages art appraisal workflows, and integrates with WordPress for content management. Built following modular design principles and best practices.

## Features

- **Payment Processing**
  - Stripe webhook handling for both test and live modes
  - Secure payment verification with signature validation
  - Automatic transaction recording in Google Sheets
  - Support for multiple payment link types (Regular, Insurance, Tax)

- **Data Management**
  - Google Sheets integration for sales and appraisals tracking
  - Comprehensive error logging system
  - Secure secret management via Google Cloud Secret Manager
  - Caching system for configuration

- **WordPress Integration**
  - Custom post type handling for appraisals
  - Media upload and management
  - ACF (Advanced Custom Fields) integration
  - Secure authentication

- **Image Processing**
  - Automatic image optimization
  - Format conversion to JPEG
  - Size limits and validation
  - EXIF data handling

- **Email Notifications**
  - SendGrid integration
  - Dynamic template support
  - HTML email templates
  - Error notifications

- **Security**
  - Webhook signature verification
  - API authentication
  - Secure secret management
  - Input validation

## Project Structure

```
├── src/
│   ├── domain/                   # Domain logic and business rules
│   │   ├── appraisal/           # Appraisal domain
│   │   │   ├── repository.js    # Appraisal data operations
│   │   │   ├── service.js       # Appraisal business logic
│   │   │   ├── types.js         # Type definitions
│   │   │   └── validator.js     # Input validation
│   │   └── payment/             # Payment domain
│   │       ├── repository.js    # Payment data operations
│   │       ├── service.js       # Payment business logic
│   │       ├── types.js         # Type definitions
│   │       └── validator.js     # Input validation
│   ├── infrastructure/          # External services integration
│   │   ├── email/              # Email service
│   │   │   └── sendgrid.js     # SendGrid integration
│   │   ├── image/              # Image processing
│   │   │   └── processor.js    # Image optimization
│   │   ├── sheets/             # Google Sheets
│   │   │   ├── client.js       # Sheets API client
│   │   │   └── logger.js       # Error logging to sheets
│   │   ├── storage/            # Cloud storage
│   │   │   └── gcs.js         # Google Cloud Storage
│   │   ├── stripe/             # Payment processing
│   │   │   └── client.js       # Stripe API client
│   │   └── wordpress/          # CMS integration
│   │       └── client.js       # WordPress API client
│   ├── routes/                 # API routes
│   │   ├── appraisalRoutes.js  # Appraisal endpoints
│   │   ├── stripeRoutes.js     # Stripe endpoints
│   │   └── webhookRoutes.js    # Webhook handlers
│   ├── utils/                  # Shared utilities
│   │   └── error/             # Error handling
│   │       └── logger.js      # Error logging
│   ├── config.js              # Configuration management
│   └── index.js              # Application entry point
└── Dockerfile                # Container configuration
```

## Data Structures

### Google Sheets Structure

#### Sales Sheet
- Session ID
- Payment Intent ID
- Customer ID
- Customer Name
- Customer Email
- Amount Paid
- Session Date
- Mode (Test/Live)

#### Pending Appraisals Sheet
- Date
- Appraisal Type
- Session ID
- Customer Email
- Customer Name
- Status
- WordPress Edit URL

#### Error Log Sheet
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

## API Endpoints

### Stripe Webhooks
- POST `/stripe-webhook`: Live mode webhook handler
- POST `/stripe-webhook-test`: Test mode webhook handler

### Stripe API
- GET `/stripe/session/:sessionId`: Retrieve session information
  - Requires `x-shared-secret` header for authentication

### Appraisal Submission
- POST `/api/appraisals`: Handle appraisal submissions
  - Multipart form data
  - Supports image uploads (main, signature, age)
  - Maximum file size: 10MB per file
  
  Processing Steps:
  1. Immediate 200 response sent to client
  2. Background processing begins:
     - Backup submitted files to Google Cloud Storage
     - Create WordPress post with appraisal details
     - Process and optimize images
     - Upload optimized images to WordPress media library
     - Update WordPress post with media IDs
     - Update ACF fields, customer_name, customer_email and session_id 
     - Record submission in Google Sheets
     - Notify appraisers backend service

  Each step is logged for monitoring and debugging purposes.
  If any step fails, the error is logged but doesn't affect the client response.

## Configuration

### Required Secrets (Google Cloud Secret Manager)
- `STRIPE_SECRET_KEY_TEST`
- `STRIPE_SECRET_KEY_LIVE`
- `STRIPE_WEBHOOK_SECRET_TEST`
- `STRIPE_WEBHOOK_SECRET_LIVE`
- `STRIPE_SHARED_SECRET`
- `SALES_SPREADSHEET_ID`
- `PENDING_APPRAISALS_SPREADSHEET_ID`
- `LOG_SPREADSHEET_ID`
- `SENDGRID_API_KEY`
- `SENDGRID_EMAIL`
- `SEND_GRID_TEMPLATE_NOTIFY_PAYMENT_RECEIVED`
- `WORDPRESS_API_URL`
- `wp_username`
- `wp_app_password`
- `SHARED_SECRET`
- `ADMIN_EMAIL`

### Environment Variables
- `PORT` (default: 8080)
- `GOOGLE_CLOUD_PROJECT_ID`
- `CHATGPT_CHAT_URL`
- `RESOLUTION_LINK`
- `ASSIGNED_TO`
- `GCS_BUCKET_NAME` (default: 'appraisily-image-backups')

## Payment Links Configuration

Currently supported payment links:
```javascript
{
  'plink_1PzzahAQSJ9n5XyNZTMmYyLJ': { productName: 'RegularArt' },
  'plink_1OnRh5AQSJ9n5XyNBhDuqbtS': { productName: 'RegularArt' },
  'plink_1OnRpsAQSJ9n5XyN2BCtWNEs': { productName: 'InsuranceArt' },
  'plink_1OnRzAAQSJ9n5XyNyLmReeCk': { productName: 'TaxArt' }
}
```

## Error Handling

The service implements comprehensive error handling:
- Input validation
- Webhook signature verification
- API authentication
- File upload validation
- Database operation error handling
- Third-party service integration error handling

## Security Features

1. **Authentication**
   - Stripe webhook signature verification
   - API shared secret authentication
   - WordPress basic authentication

2. **Data Protection**
   - Secure secret management via Google Cloud
   - Input validation and sanitization
   - File type and size validation

3. **Error Handling**
   - Secure error logging
   - No sensitive data in responses
   - Proper HTTP status codes

## Development

### API Data Structures

#### Appraisal Submission
```typescript
{
  session_id: string;       // The Stripe session ID from the URL
  description?: string;     // Optional text description provided by user
  images: {
    main: File;            // Required main artwork image
    signature?: File;      // Optional signature/marks image
    age?: File;           // Optional age indicators image
  }
}
```
This data structure is sent to the `/api/appraisals` endpoint from the frontend AppraisalUploadForm component.


### Prerequisites
- Node.js 18+
- Google Cloud project with required APIs enabled
- Stripe account with webhook endpoints configured
- WordPress installation with REST API and ACF
- SendGrid account with verified sender

### Installation
```bash
# Install dependencies
npm install

# Start the service
npm start
```

### Docker Support
```bash
# Build container
docker build -t payment-processor .

# Run container
docker run -p 8080:8080 payment-processor
```

## Testing

The service includes:
- Webhook testing endpoints
- Separate test/live mode handling
- Error logging for debugging
- Comprehensive request validation

## Monitoring

The service provides:
- Health check endpoint
- Error logging to Google Sheets
- Request tracking
- Payment processing status monitoring

## Best Practices

1. **Code Organization**
   - Modular architecture
   - Clear separation of concerns
   - Utility functions for reusability
   - Consistent error handling

2. **Security**
   - Input validation
   - Authentication
   - Secure configurations
   - Error handling

3. **Performance**
   - Asynchronous operations
   - Configuration caching
   - Optimized database queries
   - Resource management

4. **Maintenance**
   - Clear documentation
   - Consistent coding style
   - Comprehensive error logging
   - Version control