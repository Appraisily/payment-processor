# Payment Processor Service

A Node.js service that handles Stripe payments, records transactions, and manages art appraisal workflows.

## File Structure

```
├── index.js              # Main application entry point
├── config.js             # Configuration and secrets management
├── errorLogger.js        # Error logging functionality
├── Dockerfile           # Container configuration
└── package.json         # Project dependencies
```

## Endpoints

### POST `/stripe-webhook`
Handles Stripe webhook events for completed checkout sessions.

**Headers Required:**
- `stripe-signature`: Webhook signature from Stripe

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

Configure the following secrets in Google Cloud Secret Manager:

```
STRIPE_SECRET_KEY_TEST           # Stripe test environment API key
STRIPE_SECRET_KEY_LIVE          # Stripe live environment API key
STRIPE_WEBHOOK_SECRET_TEST      # Stripe test webhook signing secret
STRIPE_WEBHOOK_SECRET_LIVE      # Stripe live webhook signing secret
SALES_SPREADSHEET_ID           # Google Sheet ID for sales records
PENDING_APPRAISALS_SPREADSHEET_ID # Google Sheet ID for pending appraisals
LOG_SPREADSHEET_ID             # Google Sheet ID for error logs
SENDGRID_API_KEY              # SendGrid API key
SENDGRID_EMAIL                # Verified sender email for SendGrid
SEND_GRID_TEMPLATE_NOTIFY_PAYMENT_RECEIVED # SendGrid template ID
```

## Core Functions

### Payment Processing
```javascript
// Stripe webhook event handler
app.post('/stripe-webhook', async (req, res) => {
  // Handles payment completion events
  // Verifies webhook signatures
  // Records transactions
  // Sends confirmation emails
})
```

### Configuration Management
```javascript
// config.js
async function getSecret(secretName)
// Retrieves secrets from Google Cloud Secret Manager

async function loadConfig()
// Loads and caches all configuration values
```

### Error Logging
```javascript
// errorLogger.js
async function logError(config, errorDetails)
// Logs errors to Google Sheets with detailed information
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