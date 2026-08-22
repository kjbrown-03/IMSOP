const fs = require('fs')
const path = require('path')
const nodemailer = require('nodemailer')
const env = require('../config/env')

const transporter = nodemailer.createTransport({
  host: env.smtp.host,
  port: env.smtp.port,
  secure: env.smtp.port === 465,
  auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.password } : undefined,
  ignoreTLS: env.nodeEnv === 'development',
})

// Dev convenience only: mirrors every "sent" email to a file, independent of
// whichever terminal owns this process's stdout, so 2FA/verification codes
// stay reliably readable during local testing.
const DEV_MAILBOX_PATH = path.join(__dirname, '..', '..', '.dev-mailbox.log')

async function sendMail({ to, subject, html, text }) {
  if (env.nodeEnv === 'development' && !env.smtp.user) {
    const entry = `[${new Date().toISOString()}] To: ${to} | Subject: ${subject}\n${text || html}\n---\n`
    console.log(`[mailer:dev] To: ${to} | Subject: ${subject}\n${text || html}`)
    try {
      fs.appendFileSync(DEV_MAILBOX_PATH, entry)
    } catch {
      // Non-fatal - file logging is a dev convenience only.
    }
    return { skipped: true }
  }
  return transporter.sendMail({ from: env.smtp.from, to, subject, html, text })
}

module.exports = { sendMail }
