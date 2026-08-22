const { z } = require('zod')

// Validates req.params/query/body against a Zod schema per route, rejecting
// unknown fields and malformed types before they ever reach Prisma. This
// turns malformed input into a cheap 400 instead of a 500 from a failed
// Prisma call (or worse, a silently accepted bad value) once traffic scales.
function validate(schema) {
  const wrapper = z.object({
    params: schema.params || z.object({}).passthrough(),
    query: schema.query || z.object({}).passthrough(),
    body: schema.body || z.object({}).passthrough(),
  })

  return (req, res, next) => {
    const result = wrapper.safeParse({ params: req.params, query: req.query, body: req.body })
    if (!result.success) {
      return res.status(400).json({
        message: 'Requête invalide',
        errors: result.error.issues.map((issue) => ({
          field: issue.path.slice(1).join('.'),
          message: issue.message,
        })),
      })
    }

    req.params = result.data.params
    req.query = result.data.query
    req.body = result.data.body
    next()
  }
}

module.exports = { validate, z }
