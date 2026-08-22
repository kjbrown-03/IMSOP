function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.userRole)) {
      return res.status(403).json({ message: 'Accès refusé pour ce rôle' })
    }
    next()
  }
}

module.exports = { requireRole }
