function notFoundHandler(req, res) {
  res.status(404).json({ message: 'Ressource introuvable' })
}

function errorHandler(err, req, res, next) {
  console.error(err)
  const status = err.status || 500
  res.status(status).json({
    message: status === 500 ? 'Erreur interne du serveur' : err.message,
  })
}

module.exports = { notFoundHandler, errorHandler }
