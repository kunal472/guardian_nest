import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');
  private readonly isDev = process.env.NODE_ENV !== 'production';

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const httpContext = context.switchToHttp();
    const req = httpContext.getRequest();
    const res = httpContext.getResponse();

    const { method, url, ip } = req;
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          const statusCode = res.statusCode || 200;

          // Only emit detailed HTTP access logs in development mode or for slow requests (>500ms)
          if (this.isDev || duration > 500) {
            this.logger.log(
              `⚡ [${method}] ${url} -> ${statusCode} (${duration}ms) [${ip || '::1'}]`
            );
          }
        },
        error: (err) => {
          const duration = Date.now() - startTime;
          const statusCode = err.status || 500;
          this.logger.error(
            `❌ [${method}] ${url} -> ${statusCode} (${duration}ms) - ${err.message}`
          );
        },
      })
    );
  }
}
