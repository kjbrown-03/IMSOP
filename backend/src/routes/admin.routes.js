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
router.get('/statistiques', validate(schema.statistiques), ctrl.statistiques)
router.get('/statistiques/mensuel', ctrl.statistiquesMensuelles)

// User management (specialistes/coordinateurs) is admin-only: a coordinator
// can see the operational dashboard above, but creating/deactivating
// accounts is a higher-privilege action reserved for ADMIN.
// Ouvert à la coordination comme à l'administration : c'est le contrôleur qui
// restreint le coordinateur aux seuls comptes spécialistes (voir
// assertManageableRole). Un requireRole('ADMIN') ici l'aurait exclu de la
// gestion du réseau d'experts, qui est pourtant son métier.
router.get('/users', validate(schema.listUsers), ctrl.listUsers)
router.post('/users', validate(schema.createUser), ctrl.createUser)
router.patch('/users/:id', validate(schema.updateUser), ctrl.updateUser)
router.patch('/users/:id/active', validate(schema.setUserActive), ctrl.setUserActive)

module.exports = router
