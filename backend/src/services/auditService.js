const { prisma } = require('../lib/prisma')

async function logAction({ userId, action, entityType, entityId, dossierId, metadata, ipAddress }) {
  await prisma.auditLog.create({
    data: { userId, action, entityType, entityId, dossierId, metadata, ipAddress },
  })
}

module.exports = { logAction }
