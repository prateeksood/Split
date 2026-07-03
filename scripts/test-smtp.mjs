/**
 * Quick SMTP test — run from repo root:
 *   node scripts/test-smtp.mjs your@email.com
 */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'dotenv';
import nodemailer from 'nodemailer';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '../apps/api/.env');
if (!existsSync(envPath)) {
  console.error('Missing apps/api/.env');
  process.exit(1);
}

const env = parse(readFileSync(envPath));
const to = process.argv[2];
if (!to) {
  console.error('Usage: node scripts/test-smtp.mjs your@email.com');
  process.exit(1);
}

const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM } = env;
if (!SMTP_HOST) {
  console.error('SMTP_HOST not set in apps/api/.env');
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: Number(SMTP_PORT || 465),
  secure: Number(SMTP_PORT || 465) === 465,
  auth: { user: SMTP_USER, pass: SMTP_PASS },
});

try {
  const info = await transporter.sendMail({
    from: EMAIL_FROM || 'Split <onboarding@resend.dev>',
    to,
    subject: 'Split SMTP test',
    html: '<p>If you received this, SMTP is working.</p>',
  });
  console.log('Sent:', info.messageId);
} catch (err) {
  console.error('SMTP failed:', err?.message || err);
  process.exit(1);
}
