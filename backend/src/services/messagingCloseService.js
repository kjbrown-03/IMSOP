const cron = require('node-cron')
const { prisma } = require('../lib/prisma')

async function closeExpiredThreads() {
  const now = new Date()
  const dossiers = await prisma.dossier.findMany({
    where: { messagingClosesAt: { lte: now }, status: { notIn: ['CLOTURE', 'ANNULE'] } },
    select: { id: true },
  })
  if (dossiers.length === 0) return

  await prisma.auditLog.createMany({
    data: dossiers.map((d) => ({
      action: 'MESSAGING_AUTO_CLOSED',
      entityType: 'Dossier',
      entityId: d.id,
      dossierId: d.id,
      metadata: { reason: 'auto-close-14-days' },
    })),
  })
}

function startMessagingCloseCron() {
  // Runs once a day at 03:00 server time
  cron.schedule('0 3 * * *', () => {
    closeExpiredThreads().catch((err) => console.error('messaging auto-close failed', err))
  })
}

module.exports = { startMessagingCloseCron, closeExpiredThreads }
