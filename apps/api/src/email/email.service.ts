import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

/**
 * Sends transactional emails via Resend HTTP API (port 443 — no SMTP port issues).
 * Falls back to console logging in local dev when RESEND_API_KEY is not set.
 */
@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private resend: Resend | null = null;
  private from = 'Split <support@kunkshi.com>';

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    const from = this.config.get<string>('EMAIL_FROM');
    if (from) this.from = from;

    if (apiKey) {
      this.resend = new Resend(apiKey);
      this.logger.log('Resend email configured');
    } else if (this.config.get('NODE_ENV') === 'production') {
      this.logger.warn(
        'RESEND_API_KEY is not set — emails will NOT be delivered. Add it to Render environment variables.',
      );
    } else {
      this.logger.log('Resend not configured — email URLs will be logged to console (dev mode)');
    }
  }

  isConfigured(): boolean {
    return this.resend !== null;
  }

  // ─── Templates ────────────────────────────────────────────────────────────

  private layout(content: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta http-equiv="X-UA-Compatible" content="IE=edge"/>
<title>Split</title>
</head>
<body style="margin:0;padding:0;background-color:#0B0B10;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0B0B10;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;">

        <!-- Logo -->
        <tr><td align="center" style="padding-bottom:32px;">
          <table cellpadding="0" cellspacing="0">
            <tr><td align="center" style="background:linear-gradient(135deg,#A78BFA,#6366F1,#4F46E5);border-radius:20px;width:64px;height:64px;">
              <span style="font-size:28px;line-height:64px;display:block;">💸</span>
            </td></tr>
          </table>
          <div style="color:#F4F4FA;font-size:26px;font-weight:700;letter-spacing:-0.5px;margin-top:14px;">Split</div>
          <div style="color:#6B6B80;font-size:13px;margin-top:4px;">AI-powered expense splitting</div>
        </td></tr>

        <!-- Card -->
        <tr><td style="background-color:#16161F;border-radius:20px;border:1px solid #2A2A3A;padding:40px 36px;">
          ${content}
        </td></tr>

        <!-- Footer -->
        <tr><td align="center" style="padding-top:28px;">
          <p style="color:#4A4A5A;font-size:12px;margin:0;line-height:1.6;">
            You're receiving this because you have a Split account.<br/>
            Questions? Reply to this email or contact
            <a href="mailto:support@kunkshi.com" style="color:#8B7CFF;text-decoration:none;">support@kunkshi.com</a>
          </p>
          <p style="color:#333344;font-size:11px;margin:12px 0 0;">
            © ${new Date().getFullYear()} Split · <a href="https://split.kunkshi.com" style="color:#333344;">split.kunkshi.com</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
  }

  private button(href: string, label: string): string {
    return `<table cellpadding="0" cellspacing="0" style="margin:28px auto;">
      <tr><td align="center" style="background:linear-gradient(135deg,#8B7CFF,#6366F1);border-radius:12px;">
        <a href="${href}" style="display:inline-block;padding:14px 36px;color:#FFFFFF;font-size:15px;font-weight:600;text-decoration:none;letter-spacing:0.2px;">${label}</a>
      </td></tr>
    </table>`;
  }

  // ─── Emails ───────────────────────────────────────────────────────────────

  async sendVerificationEmail(to: string, token: string): Promise<void> {
    const appUrl = this.config.get('APP_URL', 'http://localhost:8081').replace(/\/$/, '');
    const verifyUrl = `${appUrl}/verify-email?token=${token}`;

    if (!this.resend) {
      this.logger.log(`[dev] Email verification for ${to} → ${verifyUrl}`);
      return;
    }

    const content = `
      <h1 style="color:#F4F4FA;font-size:22px;font-weight:700;margin:0 0 8px;">Verify your email</h1>
      <p style="color:#9A9AB0;font-size:14px;margin:0 0 24px;line-height:1.6;">
        One quick step — confirm your email to finish creating your Split account.
        This link expires in <strong style="color:#F4F4FA;">24 hours</strong>.
      </p>
      ${this.button(verifyUrl, 'Verify email address')}
      <p style="color:#6B6B80;font-size:13px;margin:0;text-align:center;">
        Or copy this code into the app:
      </p>
      <div style="background:#0B0B10;border:1px solid #2A2A3A;border-radius:10px;padding:14px 20px;margin-top:12px;text-align:center;">
        <code style="color:#8B7CFF;font-size:20px;letter-spacing:6px;font-weight:700;">${token.slice(0, 8).toUpperCase()}</code>
      </div>
      <div style="border-top:1px solid #2A2A3A;margin-top:32px;padding-top:20px;">
        <p style="color:#4A4A5A;font-size:12px;margin:0;line-height:1.6;">
          Button not working? Copy and paste this URL:<br/>
          <a href="${verifyUrl}" style="color:#6B6B80;word-break:break-all;">${verifyUrl}</a>
        </p>
      </div>
    `;

    const { error } = await this.resend.emails.send({
      from: this.from,
      to,
      subject: 'Verify your Split email address',
      html: this.layout(content),
    });

    if (error) {
      this.logger.error(`Failed to send verification to ${to}: ${error.message}`);
      throw new Error(error.message);
    }
    this.logger.log(`Verification email sent to ${to}`);
  }

  async sendPasswordReset(to: string, token: string): Promise<void> {
    const appUrl = this.config.get('APP_URL', 'http://localhost:8081').replace(/\/$/, '');
    const resetUrl = `${appUrl}/forgot-password?token=${token}`;

    if (!this.resend) {
      this.logger.log(`[dev] Password reset for ${to} → ${resetUrl}`);
      return;
    }

    const content = `
      <h1 style="color:#F4F4FA;font-size:22px;font-weight:700;margin:0 0 8px;">Reset your password</h1>
      <p style="color:#9A9AB0;font-size:14px;margin:0 0 24px;line-height:1.6;">
        We received a request to reset your Split password.
        This link expires in <strong style="color:#F4F4FA;">1 hour</strong>.
        If you didn't request this, you can safely ignore this email.
      </p>
      ${this.button(resetUrl, 'Reset password')}
      <div style="background:#FB718522;border:1px solid #FB718544;border-radius:10px;padding:14px 18px;margin-top:8px;">
        <p style="color:#FB7185;font-size:13px;margin:0;">
          🔒 For your security, this link can only be used once and expires in 1 hour.
        </p>
      </div>
      <div style="border-top:1px solid #2A2A3A;margin-top:32px;padding-top:20px;">
        <p style="color:#4A4A5A;font-size:12px;margin:0;line-height:1.6;">
          Button not working? Copy and paste this URL:<br/>
          <a href="${resetUrl}" style="color:#6B6B80;word-break:break-all;">${resetUrl}</a>
        </p>
      </div>
    `;

    const { error } = await this.resend.emails.send({
      from: this.from,
      to,
      subject: 'Reset your Split password',
      html: this.layout(content),
    });

    if (error) {
      this.logger.error(`Failed to send password reset to ${to}: ${error.message}`);
      throw new Error(error.message);
    }
    this.logger.log(`Password reset email sent to ${to}`);
  }
}
