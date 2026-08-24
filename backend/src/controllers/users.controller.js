const crypto = require('crypto')
const { prisma } = require('../lib/prisma')
const { putObject, getObjectStream, deleteObject } = require('../lib/s3')
const { logAction } = require('../services/auditService')
const { safeUserSelect } = require('../lib/selectors')

const EXTENSION_BY_MIME = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}
const MIME_BY_EXTENSION = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
}

const AVATAR_PREFIX = 'avatars/'
const AVATAR_PUBLIC_PATH = '/api/users/avatar/'

// The file name is the only thing a caller controls on the public route, so it
// is matched against a strict shape: 32 hex characters + a known extension.
// Anything else (path traversal, another bucket prefix) never reaches S3.
const AVATAR_FILE_NAME = /^[0-9a-f]{32}\.(jpg|png|webp)$/

// Removing the previous picture is housekeeping, never a reason to fail the
// request the user actually asked for - the new avatar is already stored.
async function discardPreviousAvatar(avatarUrl) {
  if (!avatarUrl || !avatarUrl.startsWith(AVATAR_PUBLIC_PATH)) return
  const fileName = avatarUrl.slice(AVATAR_PUBLIC_PATH.length)
  if (!AVATAR_FILE_NAME.test(fileName)) return
  try {
    await deleteObject(`${AVATAR_PREFIX}${fileName}`)
  } catch (err) {
    console.error('avatar cleanup failed', err)
  }
}

async function updateMyAvatar(req, res) {
  if (!req.file) return res.status(400).json({ message: 'Aucune image reçue' })

  const extension = EXTENSION_BY_MIME[req.file.mimetype]
  if (!extension) {
    return res.status(400).json({ message: "Format d'image non autorisé (JPEG, PNG ou WebP uniquement)" })
  }

  const current = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { avatarUrl: true },
  })
  if (!current) return res.status(404).json({ message: 'Utilisateur introuvable' })

  // A random name rather than the user id: the URL is served without
  // authentication, so it must not let anyone enumerate accounts. It also makes
  // the file immutable, which is what allows the long cache header below.
  const fileName = `${crypto.randomBytes(16).toString('hex')}.${extension}`
  await putObject(`${AVATAR_PREFIX}${fileName}`, req.file.buffer, req.file.mimetype)

  const user = await prisma.user.update({
    where: { id: req.userId },
    data: { avatarUrl: `${AVATAR_PUBLIC_PATH}${fileName}` },
    select: safeUserSelect,
  })

  await discardPreviousAvatar(current.avatarUrl)
  await logAction({ userId: req.userId, action: 'AVATAR_UPDATED', entityType: 'User', entityId: req.userId })

  res.status(201).json(user)
}

async function deleteMyAvatar(req, res) {
  const current = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { avatarUrl: true },
  })
  if (!current) return res.status(404).json({ message: 'Utilisateur introuvable' })

  const user = await prisma.user.update({
    where: { id: req.userId },
    data: { avatarUrl: null },
    select: safeUserSelect,
  })

  await discardPreviousAvatar(current.avatarUrl)
  await logAction({ userId: req.userId, action: 'AVATAR_REMOVED', entityType: 'User', entityId: req.userId })

  res.json(user)
}

// Public on purpose: <img> tags cannot send a Bearer token, and an avatar is
// shown to every counterpart in a conversation anyway. The random file name is
// what keeps it unguessable.
async function serveAvatar(req, res) {
  const { file } = req.params
  if (!AVATAR_FILE_NAME.test(file)) {
    return res.status(404).json({ message: 'Image introuvable' })
  }

  let object
  try {
    object = await getObjectStream(`${AVATAR_PREFIX}${file}`)
  } catch (err) {
    if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) {
      return res.status(404).json({ message: 'Image introuvable' })
    }
    throw err
  }

  res.setHeader('Content-Type', object.contentType || MIME_BY_EXTENSION[file.split('.').pop()])
  if (object.contentLength) res.setHeader('Content-Length', object.contentLength)
  // The name changes on every upload, so a stored file never changes content.
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')

  // Without this listener a dropped connection mid-stream would surface as an
  // uncaught error, and server.js turns those into process.exit(1).
  object.body.on('error', (err) => {
    console.error('avatar stream failed', err)
    res.destroy(err)
  })
  object.body.pipe(res)
}

module.exports = { updateMyAvatar, deleteMyAvatar, serveAvatar }
