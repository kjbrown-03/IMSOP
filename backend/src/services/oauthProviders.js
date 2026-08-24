const env = require('../config/env')

// Minimal OAuth2 (Authorization Code) config per provider. Kept dependency-free
// (no passport.js) since it's just two HTTP calls per provider - a token
// exchange and a profile fetch - both using Node's built-in fetch.
const PROVIDERS = {
  google: {
    clientId: env.oauth.google.clientId,
    clientSecret: env.oauth.google.clientSecret,
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userinfoUrl: 'https://www.googleapis.com/oauth2/v3/userinfo',
    scope: 'openid email profile',
    // Google's userinfo response uses these field names directly.
    mapProfile: (raw) => ({ email: raw.email, fullName: raw.name, avatarUrl: raw.picture }),
  },
}

function getProvider(name) {
  const provider = PROVIDERS[name]
  if (!provider) return null
  return provider
}

function isConfigured(provider) {
  return Boolean(provider.clientId && provider.clientSecret)
}

function buildAuthUrl(provider, { redirectUri, state }) {
  const params = new URLSearchParams({
    client_id: provider.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: provider.scope,
    state,
  })
  return `${provider.authUrl}?${params.toString()}`
}

async function exchangeCodeForProfile(provider, { code, redirectUri }) {
  const tokenRes = await fetch(provider.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: provider.clientId,
      client_secret: provider.clientSecret,
    }),
  })
  if (!tokenRes.ok) {
    throw new Error(`OAuth token exchange failed (${tokenRes.status}): ${await tokenRes.text()}`)
  }
  const { access_token: accessToken } = await tokenRes.json()

  const profileRes = await fetch(provider.userinfoUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!profileRes.ok) {
    throw new Error(`OAuth profile fetch failed (${profileRes.status}): ${await profileRes.text()}`)
  }
  const raw = await profileRes.json()
  return provider.mapProfile(raw)
}

module.exports = { getProvider, isConfigured, buildAuthUrl, exchangeCodeForProfile }
