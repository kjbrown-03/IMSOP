const express = require('express')
const { authenticate } = require('../middleware/auth')
const { requireRole } = require('../middleware/rbac')
const { validate } = require('../middleware/validate')
const schema = require('../schemas/admin.schema')
const ctrl = require('../controllers/admin.controller')

const router = express.Router()
router.use(authenticate, requireRole('COORDINATEUR', 'ADMIN'))

router.get('/audit-logs', validate(schema.listAuditLogs), ctrl.listAuditLogs)
router.get('/stats', ctrl.dashboardStats)

// User management (specialistes/coordinateurs) is admin-only: a coordinator
// can see the operational dashboard above, but creating/deactivating
// accounts is a higher-privilege action reserved for ADMIN.
router.get('/users', requireRole('ADMIN'), validate(schema.listUsers), ctrl.listUsers)
router.post('/users', requireRole('ADMIN'), validate(schema.createUser), ctrl.createUser)
router.patch('/users/:id', requireRole('ADMIN'), validate(schema.updateUser), ctrl.updateUser)
router.patch('/users/:id/active', requireRole('ADMIN'), validate(schema.setUserActive), ctrl.setUserActive)

module.exports = router
