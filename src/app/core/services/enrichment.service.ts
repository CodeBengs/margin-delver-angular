import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api-response.model';
import { EstimateMarginsResult, MenuItem } from '../models/menu-item.model';

@Injectable({ providedIn: 'root' })
export class EnrichmentService {
  private readonly apiBaseUrl = environment.apiBaseUrl;

  constructor(private readonly http: HttpClient) {}

  estimateMargins(sessionKey: string, itemIds: number[] = []): Observable<EstimateMarginsResult> {
    return this.http
      .post<ApiResponse<EstimateMarginsResult>>(`${this.apiBaseUrl}/menu-sessions/${sessionKey}/estimate-margins`, {
        item_ids: itemIds
      })
      .pipe(map((response) => response.result));
  }

  retryLookup(menuItemId: number, alternativeName: string): Observable<MenuItem> {
    return this.http
      .post<ApiResponse<MenuItem>>(`${this.apiBaseUrl}/menu-items/${menuItemId}/retry-lookup`, {
        alternative_name: alternativeName
      })
      .pipe(map((response) => response.result));
  }
}

