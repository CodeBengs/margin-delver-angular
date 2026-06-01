import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api-response.model';
import { ProfitabilityAnalysisResult } from '../models/profitability.model';
import { SalesUploadResult } from '../models/sales-data.model';

@Injectable({ providedIn: 'root' })
export class SalesService {
  private readonly apiBaseUrl = environment.apiBaseUrl;

  constructor(private readonly http: HttpClient) {}

  uploadSales(sessionKey: string, file: File): Observable<SalesUploadResult> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http
      .post<ApiResponse<SalesUploadResult>>(`${this.apiBaseUrl}/menu-sessions/${sessionKey}/sales-upload`, formData)
      .pipe(map((response) => response.result));
  }

  analyseSales(salesUploadId: number): Observable<ProfitabilityAnalysisResult> {
    return this.http
      .post<ApiResponse<ProfitabilityAnalysisResult>>(`${this.apiBaseUrl}/sales-uploads/${salesUploadId}/analyse`, {})
      .pipe(map((response) => response.result));
  }
}

