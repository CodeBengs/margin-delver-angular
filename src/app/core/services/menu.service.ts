import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api-response.model';
import { Ingredient } from '../models/ingredient.model';
import { MenuItem, MenuUploadResult } from '../models/menu-item.model';

@Injectable({ providedIn: 'root' })
export class MenuService {
  private readonly apiBaseUrl = environment.apiBaseUrl;

  constructor(private readonly http: HttpClient) {}

  addMenuItem(sessionKey: string, payload: Pick<MenuItem, 'name' | 'selling_price_idr'>): Observable<MenuItem> {
    return this.http
      .post<ApiResponse<MenuItem>>(`${this.apiBaseUrl}/menu-sessions/${sessionKey}/menu-items`, payload)
      .pipe(map((response) => response.result));
  }

  updateMenuItem(itemId: number, payload: Partial<Pick<MenuItem, 'name' | 'selling_price_idr'>>): Observable<MenuItem> {
    return this.http
      .patch<ApiResponse<MenuItem>>(`${this.apiBaseUrl}/menu-items/${itemId}`, payload)
      .pipe(map((response) => response.result));
  }

  deleteMenuItem(itemId: number): Observable<void> {
    return this.http
      .delete<ApiResponse<null>>(`${this.apiBaseUrl}/menu-items/${itemId}`)
      .pipe(map(() => undefined));
  }

  uploadMenu(sessionKey: string, file: File): Observable<MenuUploadResult> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http
      .post<ApiResponse<MenuUploadResult>>(`${this.apiBaseUrl}/menu-sessions/${sessionKey}/menu-upload`, formData)
      .pipe(map((response) => response.result));
  }

  addIngredient(menuItemId: number, payload: Ingredient): Observable<Ingredient> {
    return this.http
      .post<ApiResponse<Ingredient>>(`${this.apiBaseUrl}/menu-items/${menuItemId}/ingredients`, payload)
      .pipe(map((response) => response.result));
  }

  updateIngredient(ingredientId: number, payload: Partial<Ingredient>): Observable<Ingredient> {
    return this.http
      .patch<ApiResponse<Ingredient>>(`${this.apiBaseUrl}/ingredients/${ingredientId}`, payload)
      .pipe(map((response) => response.result));
  }

  deleteIngredient(ingredientId: number): Observable<void> {
    return this.http
      .delete<ApiResponse<null>>(`${this.apiBaseUrl}/ingredients/${ingredientId}`)
      .pipe(map(() => undefined));
  }
}

