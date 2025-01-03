function validatePaymentSession(session) {
  if (!session) {
    return 'Session is required';
  }

  if (!session.id) {
    return 'Session ID is required';
  }

  if (!session.payment_intent) {
    return 'Payment intent is required';
  }

  if (!session.customer_details?.email) {
    return 'Customer email is required';
  }

  if (typeof session.amount_total !== 'number' || session.amount_total <= 0) {
    return 'Valid amount is required';
  }

  if (!session.currency) {
    return 'Currency is required';
  }

  return null;
}

module.exports = {
  validatePaymentSession
};