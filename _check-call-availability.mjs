import { chromium } from 'playwright-core'
import { readFileSync } from 'node:fs'

const browser = await chromium.launch({ channel: 'msedge', headless: true })

// Two fully isolated browser contexts = two separate "browsers"/accounts.
const specialisteCtx = await browser.newContext({ viewport: { width: 1366, height: 800 } })
const patientCtx = await browser.newContext({ viewport: { width: 1366, height: 800 } })
const specialistePage = await specialisteCtx.newPage()
const patientPage = await patientCtx.newPage()

const errors = []
for (const [name, page] of [['specialiste', specialistePage], ['patient', patientPage]]) {
  page.on('pageerror', (err) => errors.push(`${name}: ${err.message}`))
}

// --- Log in specialist (needs 2FA) ---
await specialistePage.goto('http://localhost:5173/connexion/specialiste', { waitUntil: 'load' })
await specialistePage.locator('input[type="email"]').fill('specialiste@imsop.dev')
await specialistePage.locator('input[type="password"]').fill('ChangeMe123!')
await specialistePage.locator('form button').first().click()
await specialistePage.waitForURL('**/verification-2fa', { timeout: 10000 })
await specialistePage.waitForTimeout(500)

const log = readFileSync('C:/Users/USER/Downloads/IMSOP/backend/.dev-mailbox.log', 'utf8')
const match = [...log.matchAll(/To: specialiste@imsop\.dev[\s\S]*?code de vérification est\s*:\s*(\d{6})/gi)].pop()
if (!match) {
  console.log('MAILBOX_TAIL=' + log.slice(-1000))
  throw new Error('No 2FA code found in dev mailbox')
}
const code = match[1]
console.log('2FA_CODE=' + code)
await specialistePage.locator('input[placeholder="000000"]').fill(code)
await specialistePage.locator('button[type="submit"]').first().click()
await specialistePage.waitForURL('**/specialiste/**', { timeout: 10000 })

// --- Log in patient (no 2FA) ---
await patientPage.goto('http://localhost:5173/connexion/patient', { waitUntil: 'load' })
await patientPage.locator('input[type="email"]').fill('patient@imsop.dev')
await patientPage.locator('input[type="password"]').fill('ChangeMe123!')
await patientPage.locator('form button').first().click()
await patientPage.waitForURL('**/patient/**', { timeout: 10000 })

console.log('SPECIALISTE_URL=' + specialistePage.url())
console.log('PATIENT_URL=' + patientPage.url())

// Patient navigates AWAY from Messagerie to Dossiers — this is the exact
// scenario the user reported: still logged in, just not on the chat page.
await patientPage.goto('http://localhost:5173/patient/dossiers', { waitUntil: 'load' })
await patientPage.waitForTimeout(1500)
console.log('PATIENT_NOW_ON=' + patientPage.url())

// Specialist opens Messagerie and tries to call that patient.
await specialistePage.goto('http://localhost:5173/specialiste/messagerie', { waitUntil: 'load' })
await specialistePage.waitForTimeout(1500)

const videoButton = specialistePage.locator('button[aria-label="Appel vidéo"]')
await videoButton.click()
await specialistePage.waitForTimeout(2000)
await specialistePage.screenshot({ path: './_call-test-specialiste.png' })

const bodyText = await specialistePage.locator('body').innerText()
console.log('UNAVAILABLE_SHOWN=' + bodyText.includes('disponible actuellement'))
console.log('CALLING_SHOWN=' + bodyText.includes('Appel en cours'))

console.log('ERRORS=' + JSON.stringify(errors))
console.log('DONE')
await browser.close()
