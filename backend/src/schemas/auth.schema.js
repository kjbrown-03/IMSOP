const { z } = require('zod')

const registerPatient = {
  body: z.object({
    fullName: z.string().trim().min(2).max(200),
    email: z.string().trim().toLowerCase().email().max(254),
    password: z.string().min(8).max(128),
    dob: z.coerce.date().optional(),
    gender: z.enum(['homme', 'femme', 'autre']).optional(),
    phone: z.string().trim().max(30).optional(),
    nationality: z.string().trim().max(100).optional(),
    country: z.string().trim().max(100).optional(),
    city: z.string().trim().max(100).optional(),
    preferredLanguage: z.enum(['fr', 'en']).optional(),
    emergencyContactName: z.string().trim().max(200).optional(),
    emergencyContactPhone: z.string().trim().max(30).optional(),
    twoFactorLater: z.boolean().optional(),
    consentDataProcessing: z.boolean().optional(),
  }).strict(),
}

const login = {
  body: z.object({
    email: z.string().trim().toLowerCase().email().max(254),
    password: z.string().min(1).max(128),
    role: z.enum(['PATIENT', 'SPECIALISTE', 'MEDECIN_LOCAL', 'COORDINATEUR', 'ADMIN']).optional(),
  }).strict(),
}

const verifyTwoFactor = {
  body: z.object({
    challengeToken: z.string().min(1),
    code: z.string().regex(/^\d{6}$/, 'Le code doit contenir 6 chiffres'),
  }).strict(),
}

const refresh = {
  body: z.object({
    refreshToken: z.string().min(1),
  }).strict(),
}

const logout = {
  body: z.object({
    refreshToken: z.string().min(1).optional(),
  }).strict(),
}

const forgotPassword = {
  body: z.object({
    email: z.string().trim().toLowerCase().email().max(254),
  }).strict(),
}

const resetPassword = {
  body: z.object({
    token: z.string().min(1),
    newPassword: z.string().min(8).max(128),
  }).strict(),
}

const verifyEmail = {
  body: z.object({
    code: z.string().regex(/^\d{6}$/, 'Le code doit contenir 6 chiffres'),
  }).strict(),
}

const registerMedecinLocal = {
  body: z.object({
    fullName: z.string().trim().min(2).max(200),
    email: z.string().trim().toLowerCase().email(),
    password: z.string().min(8).max(128),
    phone: z.string().trim().max(40).optional(),
    specialite: z.string().trim().max(200).optional(),
    etablissement: z.string().trim().max(200).optional(),
    pays: z.string().trim().max(100).optional(),
    numeroOrdre: z.string().trim().max(100).optional(),
  }).strict(),
}

module.exports = {
  registerMedecinLocal,
  registerPatient, login, verifyTwoFactor, refresh, logout,
  forgotPassword, resetPassword, verifyEmail,
}
