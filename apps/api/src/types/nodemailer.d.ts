declare module 'nodemailer' {
  export interface Transporter {
    sendMail(options: Record<string, unknown>): Promise<unknown>;
  }
  export function createTransport(options: Record<string, unknown>): Transporter;
}
