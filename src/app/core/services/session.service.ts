import { HttpClient } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { map, Observable, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api-response.model';
import { MenuSession } from '../models/menu-item.model';

@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly apiBaseUrl = environment.apiBaseUrl;
  readonly currentSession = signal<MenuSession | null>(this.restoreSession());

  constructor(private readonly http: HttpClient) {}

  createSession(): Observable<MenuSession> {
    return this.http
      .post<ApiResponse<MenuSession>>(`${this.apiBaseUrl}/menu-sessions`, {})
      .pipe(
        map((response) => response.result),
        tap((session) => this.storeSession(session))
      );
  }

  getSession(sessionKey: string): Observable<MenuSession> {
    return this.http
      .get<ApiResponse<MenuSession>>(`${this.apiBaseUrl}/menu-sessions/${sessionKey}`)
      .pipe(
        map((response) => response.result),
        tap((session) => this.storeSession(session))
      );
  }

  ensureSession(): Observable<MenuSession> {
    const existing = this.currentSession();
    return existing ? new Observable<MenuSession>((subscriber) => {
      subscriber.next(existing);
      subscriber.complete();
    }) : this.createSession();
  }

  clearSession(): void {
    sessionStorage.removeItem('margin_delver_session');
    this.currentSession.set(null);
  }

  private storeSession(session: MenuSession): void {
    sessionStorage.setItem('margin_delver_session', JSON.stringify(session));
    this.currentSession.set(session);
  }

  private restoreSession(): MenuSession | null {
    const raw = sessionStorage.getItem('margin_delver_session');
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as MenuSession;
    } catch {
      sessionStorage.removeItem('margin_delver_session');
      return null;
    }
  }
}

