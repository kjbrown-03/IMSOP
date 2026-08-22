// Never include passwordHash (or other sensitive User fields) in API responses.
const safeUserSelect = {
  id: true,
  fullName: true,
  email: true,
  role: true,
  phone: true,
  avatarUrl: true,
}

module.exports = { safeUserSelect }
