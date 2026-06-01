import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ExportService {
  private readonly apiBaseUrl = environment.apiBaseUrl;

  constructor(private readonly http: HttpClient) {}

  downloadMarginReport(sessionKey: string): Observable<Blob> {
    return this.http.get(`${this.apiBaseUrl}/menu-sessions/${sessionKey}/export-margin`, {
      responseType: 'blob'
    });
  }

  downloadFullReport(profitabilityResultId: number): Observable<Blob> {
    return this.http.get(`${this.apiBaseUrl}/profitability-results/${profitabilityResultId}/export-report`, {
      responseType: 'blob'
    });
  }
}

