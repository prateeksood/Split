import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

function parseOriginList(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

/** CORS for browser clients (Expo web). Native apps do not send Origin and are unaffected. */
export function buildCorsOptions(): CorsOptions {
  const isProd = process.env.NODE_ENV === 'production';
  const allowedOrigins = new Set(
    [...parseOriginList(process.env.CORS_ORIGINS), process.env.APP_URL].filter(
      (o): o is string => typeof o === 'string' && o.length > 0,
    ),
  );

  return {
    origin: (origin, callback) => {
      // No Origin header: Postman, curl, native mobile — allow.
      if (!origin) {
        callback(null, true);
        return;
      }
      if (!isProd) {
        callback(null, true);
        return;
      }
      if (allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    optionsSuccessStatus: 204,
  };
}
