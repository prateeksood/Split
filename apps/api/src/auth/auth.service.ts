import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  OnModuleInit,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema, googleAuthSchema, googleCodeAuthSchema, verifyEmailSchema, resendVerificationSchema } from '@split/shared';

@Injectable()
export class AuthService implements OnModuleInit {
  private googleClient: OAuth2Client | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly email: EmailService,
  ) {}

  onModuleInit() {
    const clientId = this.config.get('GOOGLE_CLIENT_ID');
    if (clientId) {
      this.googleClient = new OAuth2Client(clientId);
    }
  }

  async register(input: unknown) {
    const data = registerSchema.parse(input);

    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email: data.email }, ...(data.username ? [{ username: data.username }] : [])] },
    });

    if (existing) {
      throw new ConflictException('Email or username already in use');
    }

    const passwordHash = await bcrypt.hash(data.password, 12);
    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        username: data.username,
        passwordHash,
        emailVerified: false,
      },
      select: { id: true, email: true },
    });

    await this.sendVerification(user.id, user.email);

    // Signup is not complete until the email is verified — no tokens are issued yet.
    return {
      requiresEmailVerification: true,
      email: user.email,
      message: 'Account created. Check your email to verify your address and finish signing up.',
    };
  }

  async login(input: unknown) {
    const data = loginSchema.parse(input);

    const user = await this.prisma.user.findUnique({ where: { email: data.email } });
    if (!user?.passwordHash || user.deletedAt) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(data.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.emailVerified) {
      throw new UnauthorizedException('EMAIL_NOT_VERIFIED');
    }

    return this.issueTokens(user.id, user.email);
  }

  /**
   * Create a fresh verification token and send the email directly (not via queue).
   * Direct sending ensures delivery for this time-critical signup step — no Redis dependency.
   */
  private async sendVerification(userId: string, email: string) {
    const token = randomBytes(32).toString('hex');
    await this.prisma.emailVerificationToken.deleteMany({ where: { userId } });
    await this.prisma.emailVerificationToken.create({
      data: { token, userId, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
    });
    // Send directly — if SMTP is not configured, EmailService logs the URL to console.
    await this.email.sendVerificationEmail(email, token);
  }

  async verifyEmail(input: unknown) {
    const { token } = verifyEmailSchema.parse(input);
    const record = await this.prisma.emailVerificationToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!record || record.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired verification token');
    }

    if (record.user.deletedAt) {
      throw new UnauthorizedException('Account is deactivated');
    }

    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: record.userId }, data: { emailVerified: true } }),
      this.prisma.emailVerificationToken.deleteMany({ where: { userId: record.userId } }),
    ]);

    // Verified → log them in immediately.
    return this.issueTokens(record.userId, record.user.email);
  }

  async resendVerification(input: unknown) {
    const { email } = resendVerificationSchema.parse(input);
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user && user.passwordHash && !user.emailVerified) {
      await this.sendVerification(user.id, user.email);
    }
    // Generic response to avoid leaking which emails exist / are verified.
    return { message: 'If that account needs verification, a new email has been sent.' };
  }

  async refresh(refreshToken: string) {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (stored.user.deletedAt) {
      // Deactivated account — clean up the token and reject.
      await this.prisma.refreshToken.deleteMany({ where: { id: stored.id } });
      throw new UnauthorizedException('Account is deactivated');
    }

    const deleted = await this.prisma.refreshToken.deleteMany({ where: { id: stored.id } });
    if (deleted.count === 0) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    return this.issueTokens(stored.user.id, stored.user.email);
  }

  async logout(refreshToken: string) {
    await this.prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
    return { success: true };
  }

  async forgotPassword(input: unknown) {
    const { email } = forgotPasswordSchema.parse(input);
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return { message: 'If that email exists, a reset link was sent.' };

    const token = randomBytes(32).toString('hex');
    await this.prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
    await this.prisma.passwordResetToken.create({
      data: {
        token,
        userId: user.id,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    await this.email.sendPasswordReset(email, token);

    // Never return the reset token in the API response — it is a credential.
    // In local dev without SMTP, the token is available in server logs only.
    return { message: 'If that email exists, a reset link was sent.' };
  }

  async resetPassword(input: unknown) {
    const { token, password } = resetPasswordSchema.parse(input);
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!record || record.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
      this.prisma.passwordResetToken.delete({ where: { id: record.id } }),
      // Invalidate all existing sessions so stolen sessions can't persist after a password reset.
      this.prisma.refreshToken.deleteMany({ where: { userId: record.userId } }),
    ]);

    return { message: 'Password updated successfully' };
  }

  async googleLogin(input: unknown) {
    const { idToken } = googleAuthSchema.parse(input);
    const payload = await this.verifyGoogleIdToken(idToken);
    return this.signInGoogleUser(payload);
  }

  async googleCodeLogin(input: unknown) {
    const { code, redirectUri, codeVerifier } = googleCodeAuthSchema.parse(input);
    const clientId = this.config.get('GOOGLE_CLIENT_ID');
    const clientSecret = this.config.get('GOOGLE_CLIENT_SECRET');
    if (!clientId || !clientSecret) {
      throw new UnauthorizedException('Google OAuth code exchange is not configured on the server');
    }

    const client = new OAuth2Client(clientId, clientSecret, redirectUri);
    let idToken: string | undefined;
    try {
      const { tokens } = await client.getToken({ code, redirect_uri: redirectUri, codeVerifier });
      idToken = tokens.id_token ?? undefined;
    } catch {
      throw new UnauthorizedException('Failed to exchange Google authorization code');
    }

    if (!idToken) {
      throw new UnauthorizedException('Google did not return an ID token');
    }

    const payload = await this.verifyGoogleIdToken(idToken);
    return this.signInGoogleUser(payload);
  }

  private async verifyGoogleIdToken(idToken: string) {
    const clientId = this.config.get('GOOGLE_CLIENT_ID');
    if (!clientId || !this.googleClient) {
      throw new UnauthorizedException('Google OAuth is not configured on the server');
    }

    const audiences = [
      clientId,
      this.config.get('GOOGLE_IOS_CLIENT_ID'),
      this.config.get('GOOGLE_ANDROID_CLIENT_ID'),
    ].filter(Boolean) as string[];

    try {
      const ticket = await this.googleClient.verifyIdToken({ idToken, audience: audiences });
      return ticket.getPayload() ?? {};
    } catch {
      throw new UnauthorizedException('Invalid Google token');
    }
  }

  private async signInGoogleUser(payload: {
    sub?: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
    picture?: string;
  }) {
    if (!payload.email || !payload.email_verified || !payload.sub) {
      throw new UnauthorizedException('Google account email is not verified');
    }

    const googleId = payload.sub;
    const email = payload.email;
    const name = payload.name ?? email.split('@')[0];
    const avatarUrl = payload.picture;

    let user = await this.prisma.user.findFirst({
      where: { OR: [{ googleId }, { email }] },
    });

    if (user) {
      if (user.deletedAt) throw new UnauthorizedException('Account is deactivated');

      // If this is an email-only account (no googleId yet) that has NOT been email-verified,
      // block Google login to prevent account takeover of a pending registration.
      if (!user.googleId && !user.emailVerified) {
        throw new UnauthorizedException(
          'An account with this email is pending email verification. Verify your email first, then link Google via settings.',
        );
      }

      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          googleId,
          avatarUrl: avatarUrl ?? user.avatarUrl,
          name: user.name || name,
          emailVerified: true,
        },
      });
    } else {
      user = await this.prisma.user.create({
        data: { email, name, googleId, avatarUrl, emailVerified: true },
      });
    }

    return this.issueTokens(user.id, user.email);
  }

  private async issueTokens(userId: string, email: string) {
    const accessToken = this.jwt.sign(
      { sub: userId, email },
      { secret: this.config.getOrThrow('JWT_SECRET'), expiresIn: this.config.get('JWT_EXPIRES_IN', '15m') },
    );

    const refreshToken = randomBytes(48).toString('hex');
    const expiresIn = this.config.get('JWT_REFRESH_EXPIRES_IN', '7d');
    const days = parseInt(expiresIn.replace('d', ''), 10) || 7;

    await this.prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId,
        expiresAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
      },
    });

    return { accessToken, refreshToken };
  }
}
