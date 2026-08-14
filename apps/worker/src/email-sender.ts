import type { SmtpConfig } from './config'

export interface EmailSender {
  sendMail(options: { to: string; subject: string; html: string }): Promise<void>
}

export async function createEmailSender(config: SmtpConfig): Promise<EmailSender> {
  const nodemailer = await import('nodemailer')
  const transporter = nodemailer.default.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: false,
    auth: config.smtpUser
      ? { user: config.smtpUser, pass: config.smtpPass }
      : undefined,
  })

  return {
    async sendMail(options) {
      await transporter.sendMail({
        from: config.mailFrom,
        to: options.to,
        subject: options.subject,
        html: options.html,
      })
    },
  }
}
