import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

export interface ApiError {
  code: string;
  message: string;
  statusCode: number;
}

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      const apiError: ApiError = {
        code: error.error?.code ?? 'REQUEST_FAILED',
        message: error.error?.message ?? 'Request failed. Please try again.',
        statusCode: error.status
      };

      return throwError(() => apiError);
    })
  );
};

