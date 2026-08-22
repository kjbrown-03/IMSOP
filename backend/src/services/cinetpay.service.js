const env = require('../config/env')

async function initTransaction({ transactionId, amount, currency, description, customerName }) {
  const payload = {
    apikey: env.cinetpay.apiKey,
    site_id: env.cinetpay.siteId,
    transaction_id: transactionId,
    amount,
    currency,
    description,
    notify_url: env.cinetpay.notifyUrl,
    return_url: env.cinetpay.returnUrl,
    customer_name: customerName,
    channels: 'ALL',
  }

  const response = await fetch('https://api-checkout.cinetpay.com/v2/payment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error(`CinetPay init failed with status ${response.status}`)
  }

  return response.json()
}

async function verifyTransaction(transactionId) {
  const response = await fetch('https://api-checkout.cinetpay.com/v2/payment/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apikey: env.cinetpay.apiKey,
      site_id: env.cinetpay.siteId,
      transaction_id: transactionId,
    }),
  })

  if (!response.ok) {
    throw new Error(`CinetPay verify failed with status ${response.status}`)
  }

  return response.json()
}

module.exports = { initTransaction, verifyTransaction }
