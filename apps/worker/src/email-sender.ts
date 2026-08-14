import type { EmailEvent } from '@lynx/shared'
import type { SmtpConfig } from './config'

export interface EmailSender {
  sendEmail(event: EmailEvent): Promise<void>
}

function buildWelcomeEmail(name: string): { subject: string; html: string } {
  return {
    subject: 'Welcome to LYNX!',
    html: `
      <h1>Welcome to LYNX, ${name}!</h1>
      <p>Your account has been created successfully.</p>
      <p>You can now create short links and track their analytics.</p>
      <p>— The LYNX Team</p>
    `,
  }
}

function buildResetEmail(resetUrl: string): { subject: string; html: string } {
  return {
    subject: 'Reset your LYNX password',
    html: `
      <h1>Password Reset</h1>
      <p>You requested a password reset.</p>
      <p><a href="${resetUrl}">Click here to reset your password</a></p>
      <p>This link expires in 1 hour.</p>
      <p>If you didn't request this, you can safely ignore this email.</p>
      <p>— The LYNX Team</p>
    `,
  }
}

export async function createEmailSender(config: SmtpConfig): Promise<EmailSender> {
  const nodemailer = await import('nodemailer')
  const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3001'
  const transporter = nodemailer.default.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: false,
    auth: config.smtpUser
      ? { user: config.smtpUser, pass: config.smtpPass }
      : undefined,
  })

  return {
    async sendEmail(event) {
      let subject: string
      let html: string

      if (event.type === 'welcome') {
        const result = buildWelcomeEmail(event.name ?? 'User')
        subject = result.subject
        html = result.html
      } else if (event.type === 'reset') {
        const resetUrl = `${frontendUrl}/reset-password?token=${event.token}`
        const result = buildResetEmail(resetUrl)
        subject = result.subject
        html = result.html
      } else {
        throw new Error(`Unknown email type: ${event.type}`)
      }

      await transporter.sendMail({
        from: config.mailFrom,
        to: event.to,
        subject,
        html,
      })
    },
  }
}
