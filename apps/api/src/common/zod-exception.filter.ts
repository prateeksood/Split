import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { ZodError } from 'zod';

/**
 * Maps Zod validation failures (thrown from service-layer `schema.parse(...)`)
 * to a clean 400 Bad Request instead of leaking a 500 with a stack trace.
 */
@Catch(ZodError)
export class ZodExceptionFilter implements ExceptionFilter {
  catch(exception: ZodError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const first = exception.issues[0];
    const path = first?.path?.length ? `${first.path.join('.')}: ` : '';
    const message = first ? `${path}${first.message}` : 'Invalid request';

    response.status(HttpStatus.BAD_REQUEST).json({
      statusCode: HttpStatus.BAD_REQUEST,
      error: 'Bad Request',
      message,
    });
  }
}
