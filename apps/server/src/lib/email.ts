import { Resend } from 'resend'

export async function sendPasswordResetEmail(to: string, code: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  const from   = process.env.RESEND_FROM_EMAIL ?? 'noreply@chamble.app'

  if (!apiKey) {
    // Dev fallback: print to console instead of sending
    console.log(`[dev] Password reset code for ${to}: ${code}`)
    return
  }

  const resend = new Resend(apiKey)
  const { error } = await resend.emails.send({
    from,
    to,
    subject: 'Chamble — Your password reset code',
    html: `
      <div style="font-family:sans-serif;max-width:420px;margin:0 auto;padding:32px 24px;background:#0f0f13;border-radius:12px;">
        <h2 style="margin:0 0 8px;font-size:24px;color:#818cf8;font-weight:700;">Chamble</h2>
        <p style="margin:0 0 24px;color:#94a3b8;font-size:14px;">Chess + Gamble</p>
        <p style="color:#e2e8f0;font-size:15px;margin:0 0 16px;">Your password reset code is:</p>
        <div style="font-size:36px;font-weight:700;font-family:monospace;letter-spacing:10px;color:#818cf8;background:#1e1e2e;border:1px solid #2d2d3d;border-radius:8px;padding:16px;text-align:center;">
          ${code}
        </div>
        <p style="margin:20px 0 0;color:#64748b;font-size:13px;line-height:1.5;">
          This code expires in <strong style="color:#94a3b8;">15 minutes</strong>.<br>
          If you didn't request a password reset, you can safely ignore this email.
        </p>
      </div>
    `,
  })

  if (error) throw new Error(`Failed to send email: ${error.message}`)
}

export async function sendVerificationEmail(to: string, code: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  const from   = process.env.RESEND_FROM_EMAIL ?? 'noreply@chamble.app'

  if (!apiKey) {
    console.log(`[dev] Email verification code for ${to}: ${code}`)
    return
  }

  const resend = new Resend(apiKey)
  const { error } = await resend.emails.send({
    from,
    to,
    subject: 'Chamble — Verify your email',
    html: `
      <div style="font-family:sans-serif;max-width:420px;margin:0 auto;padding:32px 24px;background:#0f0f13;border-radius:12px;">
        <h2 style="margin:0 0 8px;font-size:24px;color:#818cf8;font-weight:700;">Chamble</h2>
        <p style="margin:0 0 24px;color:#94a3b8;font-size:14px;">Chess + Gamble</p>
        <p style="color:#e2e8f0;font-size:15px;margin:0 0 16px;">Enter this code to verify your email address:</p>
        <div style="font-size:36px;font-weight:700;font-family:monospace;letter-spacing:10px;color:#818cf8;background:#1e1e2e;border:1px solid #2d2d3d;border-radius:8px;padding:16px;text-align:center;">
          ${code}
        </div>
        <p style="margin:20px 0 0;color:#64748b;font-size:13px;line-height:1.5;">
          This code expires in <strong style="color:#94a3b8;">30 minutes</strong>.<br>
          If you didn't create a Chamble account, you can safely ignore this email.
        </p>
      </div>
    `,
  })

  if (error) throw new Error(`Failed to send email: ${error.message}`)
}
