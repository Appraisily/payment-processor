const stripe = require('stripe');
const CustomerRepository = require('../repositories/customer.repository');
const NotificationService = require('./notification.service');

class PaymentService {
  constructor(config) {
    this.config = config;
    this.customerRepo = new CustomerRepository(config);
    this.notificationService = new NotificationService(config);
    this.stripe = stripe(this.config.STRIPE_SECRET_KEY_LIVE);
  }

  async finalizeSession(sessionId, appraisalType, sessionStatus) {
    const pricePerItem = {
      regular: 2500,    // $25 per item
      insurance: 5000,  // $50 per item
      IRS: 7500        // $75 per item
    };

    const appraisalTypeDescriptions = {
      regular: 'Standard art appraisal',
      insurance: 'Insurance valuation appraisal',
      IRS: 'IRS documentation appraisal'
    };

    if (!sessionStatus.session.items.length) {
      throw new Error('No files uploaded in this session');
    }

    // Update metadata
    await this.customerRepo.updateFinalizationInfo(sessionId, {
      appraisal_type: appraisalType,
      files_count: sessionStatus.session.items.length
    });

    // Create Stripe checkout session
    const customerInfo = await this.customerRepo.getCustomerInfo(sessionId);
    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `${appraisalTypeDescriptions[appraisalType]} - ${sessionStatus.session.items.length} items`,
            description: `Bulk ${appraisalType} appraisal service for ${sessionStatus.session.items.length} items`
          },
          unit_amount: pricePerItem[appraisalType] * sessionStatus.session.items.length
        },
        quantity: 1
      }],
      customer_email: customerInfo.email,
      metadata: {
        bulk_session_id: sessionId,
        items_count: sessionStatus.session.items.length.toString(),
        appraisal_type: appraisalType
      },
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URL || 'https://www.appraisily.com'}/bulk-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL || 'https://www.appraisily.com'}/bulk-cancel?session_id={CHECKOUT_SESSION_ID}`
    });

    return { checkout_url: session.url };
  }
}