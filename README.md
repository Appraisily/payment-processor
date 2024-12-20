# Payment Processor Service

A Node.js service that handles Stripe payments, records transactions, manages art appraisal workflows, and integrates with WordPress for content management.

## File Structure

```
├── src/
│   ├── index.js                    # Main application entry point
│   ├── config.js                   # Configuration and secrets management
│   ├── routes/
│   │   ├── webhookRoutes.js       # Stripe webhook handling
│   │   ├── stripeRoutes.js        # Stripe API endpoints
│   │   └── appraisalRoutes.js     # Appraisal submission handling
│   ├── services/
│   │   ├── webhookHandler.js      # Webhook processing logic
│   │   ├── checkoutProcessor.js   # Checkout session processing
│   │   ├── backgroundProcessor.js  # Async image processing
│   │   └── appraisalProcessor.js  # Appraisal submission processing
│   └── utils/
│       ├── errorLogger.js         # Error logging to Google Sheets
│       ├── emailService.js        # Email notifications
│       ├── imageProcessor.js      # Image optimization
│       ├── validators.js          # Request validation
│       └── wordPressClient.js     # WordPress API integration
├── Dockerfile                     # Container configuration
└── package.json                   # Project dependencies
```

## Endpoints

### Stripe Webhooks

#### POST `/stripe-webhook`
Handles Stripe webhook events for completed checkout sessions.

**Headers Required:**
- `stripe-signature`: Webhook signature from Stripe

#### POST `/stripe-webhook-test`
Test environment webhook endpoint with the same functionality.

### Stripe API

#### GET `/stripe/session/:sessionId`
Retrieves session information from Stripe.

**Headers Required:**
- `x-shared-secret`: Authentication secret

**Response:**
```json
{
  "customer_details": {
    "name": "string",
    "email": "string"
  },
  "amount_total": number,
  "currency": "string",
  "payment_status": "string"
}
```

### Appraisal Submission

#### POST `/api/appraisals`
Handles appraisal submissions with image uploads.

**Content-Type:** `multipart/form-data`

**Fields:**
- `session_id`: Stripe session ID
- `customer_email`: Customer's email
- `customer_name`: (optional) Customer's name
- `description`: (optional) Appraisal description
- `main`: Main image file
- `signature`: (optional) Signature image file
- `age`: (optional) Age verification image file

**Response:**
```json
{
  "success": true,
  "post_id": number,
  "post_url": "string"
}
```

**Webhook Event Structure:**
```json
{
  "type": "checkout.session.completed",
  "data": {
    "object": {
      "id": "cs_test_...",
      "payment_intent": "pi_...",
      "customer": "cus_...",
      "amount_total": 1000,
      "currency": "usd",
      "customer_details": {
        "email": "customer@example.com",
        "name": "John Doe"
      },
      "created": 1234567890,
      "payment_link": "plink_..."
    }
  }
}
```

### GET `/`
Health check endpoint that returns service status.

## Required Secrets

The following secrets must be configured in Google Cloud Secret Manager:

```
STRIPE_SECRET_KEY_TEST            # Stripe test environment API key
STRIPE_SECRET_KEY_LIVE           # Stripe live environment API key
STRIPE_WEBHOOK_SECRET_TEST       # Stripe test webhook signing secret
STRIPE_WEBHOOK_SECRET_LIVE       # Stripe live webhook signing secret
STRIPE_SHARED_SECRET            # Shared secret for API authentication
SALES_SPREADSHEET_ID            # Google Sheet ID for sales records
PENDING_APPRAISALS_SPREADSHEET_ID # Google Sheet ID for pending appraisals
LOG_SPREADSHEET_ID              # Google Sheet ID for error logs
SENDGRID_API_KEY               # SendGrid API key
SENDGRID_EMAIL                 # Verified sender email for SendGrid
SEND_GRID_TEMPLATE_NOTIFY_PAYMENT_RECEIVED # SendGrid template ID
WORDPRESS_API_URL              # WordPress REST API endpoint
wp_username                    # WordPress username
wp_app_password               # WordPress application password
ADMIN_EMAIL                   # Admin notification email
SHARED_SECRET                 # Secret for backend communication
```

## Core Functions

### Configuration Management
- `loadConfig()`: Loads and caches all configuration values from Secret Manager
- `getSecret(secretName)`: Retrieves individual secrets

### Payment Processing
- `handleStripeWebhook(req, res, config, mode)`: Processes Stripe webhook events
- `processCheckoutSession(session, config, mode)`: Handles completed checkout sessions

### Appraisal Management
- `processAppraisalSubmission(req, config)`: Handles new appraisal submissions
- `processImagesAndUpdate(data)`: Processes and uploads appraisal images
- `optimizeImage(buffer)`: Optimizes uploaded images

### WordPress Integration
- `createInitialPost(postData, config)`: Creates WordPress posts
- `uploadMedia(buffer, filename, config)`: Uploads media files
- `updatePostWithMedia(postId, updateData, config)`: Updates posts with media

### Error Logging
- `logError(config, errorDetails)`: Logs errors to Google Sheets

### Email Notifications
- `sendAppraisalNotification(data)`: Sends email notifications for new submissions

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

## Product Types

The service handles different types of art appraisals:
```json
{
  "plink_1PzzahAQSJ9n5XyNZTMmYyLJ": { "productName": "RegularArt" },
  "plink_1OnRh5AQSJ9n5XyNBhDuqbtS": { "productName": "RegularArt" },
  "plink_1OnRpsAQSJ9n5XyN2BCtWNEs": { "productName": "InsuranceArt" },
  "plink_1OnRzAAQSJ9n5XyNyLmReeCk": { "productName": "TaxArt" }
}
```

## Environment Variables

Optional environment variables:
```
PORT                    # Server port (default: 8080)
GOOGLE_CLOUD_PROJECT_ID # Google Cloud project ID
CHATGPT_CHAT_URL       # Support chat URL
RESOLUTION_LINK        # Issue resolution link
ASSIGNED_TO            # Default assignee for issues
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