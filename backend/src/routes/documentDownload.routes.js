const express = require('express')
const { authenticate } = require('../middleware/auth')
const { validate } = require('../middleware/validate')
const { downloadDocument: downloadSchema } = require('../schemas/documents.schema')
const { downloadDocument } = require('../controllers/documents.controller')

const router = express.Router()
router.get('/:id/download', authenticate, validate(downloadSchema), downloadDocument)

module.exports = router
