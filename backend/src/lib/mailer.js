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
  // No SMTP credentials outside production means there is no relay to talk to:
  // attempting the round-trip would hang the caller on a connection timeout.
  // Production is deliberately excluded from this branch - there, a missing
  // SMTP_USER must surface as a real error, not silently drop the mail.
  if (env.nodeEnv !== 'production' && !env.smtp.user) {
    // The automated suite calls this on nearly every request (notify() is
    // wired into registration, 2FA, assignment...). Mirroring all of it to
    // stdout and to the dev mailbox would bury the test report and grow the
    // log file on every run, so tests get the no-op without the paperwork.
    if (env.nodeEnv === 'test') return { skipped: true }

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
