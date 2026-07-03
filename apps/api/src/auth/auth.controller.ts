import { Body, Controller, Post, HttpCode, BadRequestException, Req, Res } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';

// Sensitive credential endpoints: tight per-IP limits to deter brute force / abuse.
const AUTH_THROTTLE = { default: { limit: 10, ttl: 60000 } };
const RESET_THROTTLE = { default: { limit: 5, ttl: 3600000 } };

const REFRESH_COOKIE = 'refresh_token';
const REFRESH_MAX_AGE = 30 * 24 * 60 * 60 * 1000;

function requireToken(token: unknown): string {
  if (typeof token !== 'string' || token.trim().length === 0 || token.length > 512) {
    throw new BadRequestException('A valid refreshToken is required');
  }
  return token;
}

function setRefreshCookie(res: Response, token: string) {
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    path: '/auth',
    maxAge: REFRESH_MAX_AGE,
  });
}

function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE, { path: '/auth' });
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  /** Set the refresh-token cookie (used by web clients) alongside the body tokens. */
  private withCookie<T extends { refreshToken?: string }>(res: Response, tokens: T): T {
    if (tokens?.refreshToken) setRefreshCookie(res, tokens.refreshToken);
    return tokens;
  }

  @Post('register')
  @Throttle(AUTH_THROTTLE)
  @ApiOperation({ summary: 'Register a new user (sends verification email)' })
  register(@Body() body: unknown) {
    return this.auth.register(body);
  }

  @Post('login')
  @Throttle(AUTH_THROTTLE)
  @HttpCode(200)
  @ApiOperation({ summary: 'Login with email and password' })
  async login(@Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    return this.withCookie(res, await this.auth.login(body));
  }

  @Post('refresh')
  @Throttle(AUTH_THROTTLE)
  @HttpCode(200)
  @ApiOperation({ summary: 'Refresh access token' })
  async refresh(
    @Body('refreshToken') bodyToken: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = requireToken(bodyToken ?? req.cookies?.[REFRESH_COOKIE]);
    return this.withCookie(res, await this.auth.refresh(token));
  }

  @Post('logout')
  @HttpCode(200)
  @ApiOperation({ summary: 'Logout and invalidate refresh token' })
  async logout(
    @Body('refreshToken') bodyToken: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = bodyToken ?? req.cookies?.[REFRESH_COOKIE];
    clearRefreshCookie(res);
    return this.auth.logout(requireToken(token));
  }

  @Post('forgot-password')
  @Throttle(RESET_THROTTLE)
  @HttpCode(200)
  @ApiOperation({ summary: 'Request password reset email' })
  forgotPassword(@Body() body: unknown) {
    return this.auth.forgotPassword(body);
  }

  @Post('reset-password')
  @Throttle(RESET_THROTTLE)
  @HttpCode(200)
  @ApiOperation({ summary: 'Reset password with token' })
  resetPassword(@Body() body: unknown) {
    return this.auth.resetPassword(body);
  }

  @Post('verify-email')
  @Throttle(AUTH_THROTTLE)
  @HttpCode(200)
  @ApiOperation({ summary: 'Verify email with token (completes signup, logs in)' })
  async verifyEmail(@Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    return this.withCookie(res, await this.auth.verifyEmail(body));
  }

  @Post('resend-verification')
  @Throttle(RESET_THROTTLE)
  @HttpCode(200)
  @ApiOperation({ summary: 'Resend the email verification link' })
  resendVerification(@Body() body: unknown) {
    return this.auth.resendVerification(body);
  }

  @Post('google')
  @Throttle(AUTH_THROTTLE)
  @HttpCode(200)
  @ApiOperation({ summary: 'Sign in with Google ID token' })
  async googleLogin(@Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    return this.withCookie(res, await this.auth.googleLogin(body));
  }

  @Post('google/code')
  @Throttle(AUTH_THROTTLE)
  @HttpCode(200)
  @ApiOperation({ summary: 'Sign in with Google authorization code (web PKCE fallback)' })
  async googleCodeLogin(@Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    return this.withCookie(res, await this.auth.googleCodeLogin(body));
  }
}
