const { z } = require('zod')

const listAuditLogs = {
  query: z.object({
    dossierId: z.string().uuid().optional(),
    entityType: z.string().trim().max(100).optional(),
    take: z.coerce.number().int().min(1).max(500).optional(),
  }).strict(),
}

const MANAGEABLE_ROLE = z.enum(['SPECIALISTE', 'COORDINATEUR'])

const listUsers = {
  query: z.object({
    role: MANAGEABLE_ROLE,
    active: z.enum(['true', 'false']).optional(),
    q: z.string().trim().max(200).optional(),
  }).strict(),
}

const createUser = {
  body: z.object({
    role: MANAGEABLE_ROLE,
    fullName: z.string().trim().min(2).max(200),
    email: z.string().trim().toLowerCase().email().max(254),
    password: z.string().min(8).max(128).optional(),
    phone: z.string().trim().max(30).optional(),
    specialite: z.string().trim().max(200).optional(),
    pays: z.string().trim().max(100).optional(),
    etablissement: z.string().trim().max(200).optional(),
    langues: z.string().trim().max(200).optional(),
    bio: z.string().trim().max(2000).optional(),
  }).strict(),
}

const idParam = { params: z.object({ id: z.string().uuid() }).strict() }

const updateUser = {
  params: idParam.params,
  body: z.object({
    fullName: z.string().trim().min(2).max(200).optional(),
    email: z.string().trim().toLowerCase().email().max(254).optional(),
    phone: z.string().trim().max(30).optional(),
    specialite: z.string().trim().max(200).optional(),
    pays: z.string().trim().max(100).optional(),
    etablissement: z.string().trim().max(200).optional(),
    langues: z.string().trim().max(200).optional(),
    bio: z.string().trim().max(2000).optional(),
    disponible: z.boolean().optional(),
  }).strict(),
}

const setUserActive = {
  params: idParam.params,
  body: z.object({ active: z.boolean() }).strict(),
}

module.exports = { listAuditLogs, listUsers, createUser, updateUser, setUserActive, idParam }
