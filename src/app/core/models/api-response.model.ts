export interface ApiResponse<T> {
  status: 'success' | 'fail';
  code?: string;
  message: string;
  result: T;
}

