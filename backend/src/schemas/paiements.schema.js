const { z } = require('zod')
const { paramsWithId } = require('./common.schema')

const dossierScoped = { params: paramsWithId('dossierId') }

// CinetPay controls this payload's shape - we only assert that a transaction
// id is present under one of its known field names. Everything else is kept
// as-is (passthrough) since it's stored verbatim in rawWebhookPayload and the
// actual trust decision comes from re-verifying with CinetPay's API, not from
// this body.
const webhook = {
  body: z.object({
    cpm_trans_id: z.string().min(1).optional(),
    transaction_id: z.string().min(1).optional(),
  }).passthrough().refine((v) => v.cpm_trans_id || v.transaction_id, {
    message: 'transaction_id manquant',
  }),
}

// Même logique que pour CinetPay : on n'exige que l'identifiant, le reste est
// conservé tel quel et la confiance vient de la relecture auprès de Fapshi.
const webhookFapshi = {
  body: z.object({
    transId: z.string().min(1),
  }).passthrough(),
}

module.exports = { dossierScoped, webhook, webhookFapshi }
