import { HttpErrorResponse, HttpHandlerFn, HttpRequest } from '@angular/common/http';
import { lastValueFrom, of, throwError } from 'rxjs';

import { ApiError, errorInterceptor } from './error.interceptor';

function run(error: HttpErrorResponse): Promise<ApiError> {
  const req = new HttpRequest('GET', '/x');
  const next: HttpHandlerFn = () => throwError(() => error);
  return lastValueFrom(errorInterceptor(req, next)).then(
    () => Promise.reject('expected error'),
    (e: ApiError) => e
  );
}

describe('errorInterceptor', () => {
  it('passes through successful responses untouched', async () => {
    const req = new HttpRequest('GET', '/x');
    const next: HttpHandlerFn = () => of('ok' as any);
    await expectAsync(lastValueFrom(errorInterceptor(req, next))).toBeResolvedTo('ok' as any);
  });

  it('maps an HttpErrorResponse with a structured body', async () => {
    const apiError = await run(
      new HttpErrorResponse({
        status: 400,
        error: { code: 'BAD_INPUT', message: 'Invalid field' }
      })
    );
    expect(apiError).toEqual({ code: 'BAD_INPUT', message: 'Invalid field', statusCode: 400 });
  });

  it('falls back to defaults when the body has no code/message', async () => {
    const apiError = await run(new HttpErrorResponse({ status: 500, error: {} }));
    expect(apiError.code).toBe('REQUEST_FAILED');
    expect(apiError.message).toBe('Request failed. Please try again.');
    expect(apiError.statusCode).toBe(500);
  });
});
