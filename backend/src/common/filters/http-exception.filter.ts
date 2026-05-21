import { ExceptionFilter, Catch, ArgumentsHost, HttpException } from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const err = exception as Error;
    console.error('[HttpExceptionFilter]', err.message || String(exception));
    if (err.stack) console.error(err.stack.split('\n').slice(0,3).join('\n'));
    let status = 500;
    let message = '服务器内部错误';
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      message = typeof body === 'string' ? body : (body as any).message || message;
    } else if (err.message) {
      message = err.message;
    }
    res.status(status).json({ code: status, message, data: null });
  }
}
