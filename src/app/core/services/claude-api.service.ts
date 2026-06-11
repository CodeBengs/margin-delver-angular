import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, map, Observable, throwError } from 'rxjs';

import { storageGet } from '../utils/storage.util';

export interface ClaudeCallParams {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  model?: string;
  maxTokens?: number;
}

interface ClaudeApiRequest {
  model: string;
  max_tokens: number;
  temperature: number;
  system: string;
  messages: Array<{ role: string; content: string }>;
}

interface ClaudeApiResponse {
  content: Array<{ type: string; text: string }>;
}

@Injectable({ providedIn: 'root' })
export class ClaudeApiService {
  private readonly apiUrl = 'https://api.anthropic.com/v1/messages';

  constructor(private readonly http: HttpClient) {}

  call(params: ClaudeCallParams): Observable<string> {
    const apiKey = storageGet('md_claude_api_key_v1');
    if (!apiKey) {
      return throwError(
        () => new Error('API key not configured. Please add your Claude API key in Settings.')
      );
    }

    const model =
      params.model ??
      storageGet('md_claude_model_v1') ??
      'claude-sonnet-4-6';

    const headers = new HttpHeaders({
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'anthropic-dangerous-direct-browser-access': 'true'
    });

    const body: ClaudeApiRequest = {
      model,
      max_tokens: params.maxTokens ?? 4096,
      temperature: params.temperature ?? 0.2,
      system: params.systemPrompt,
      messages: [{ role: 'user', content: params.userPrompt }]
    };

    return this.http.post<ClaudeApiResponse>(this.apiUrl, body, { headers }).pipe(
      map((response) => response.content[0].text),
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401) {
          return throwError(
            () => new Error('Invalid API key. Please check your Claude API key in Settings.')
          );
        }
        if (error.status === 429) {
          return throwError(
            () => new Error('Rate limit exceeded. Please wait a moment and try again.')
          );
        }
        if (error.status >= 400) {
          return throwError(() => new Error(`Claude API error: ${error.status}`));
        }
        return throwError(() => error);
      })
    );
  }
}
