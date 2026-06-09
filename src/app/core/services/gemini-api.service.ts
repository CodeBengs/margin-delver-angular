import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, map, Observable, throwError } from 'rxjs';

export interface GeminiCallParams {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
}

interface GeminiApiResponse {
  candidates: Array<{
    content: { parts: Array<{ text: string }> };
  }>;
}

@Injectable({ providedIn: 'root' })
export class GeminiApiService {
  private readonly apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

  constructor(private readonly http: HttpClient) {}

  call(params: GeminiCallParams): Observable<string> {
    const apiKey = localStorage.getItem('md_gemini_api_key_v1');
    if (!apiKey) {
      return throwError(
        () => new Error('Gemini API key not configured. Please add your Google AI API key in Settings.')
      );
    }

    const body = {
      system_instruction: { parts: [{ text: params.systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: params.userPrompt }] }],
      generationConfig: {
        temperature: params.temperature ?? 0.2,
        maxOutputTokens: params.maxTokens ?? 4096
      }
    };

    return this.http.post<GeminiApiResponse>(`${this.apiUrl}?key=${apiKey}`, body).pipe(
      map((response) => response.candidates[0].content.parts[0].text),
      catchError((error: HttpErrorResponse) => {
        if (error.status === 403) {
          return throwError(() => new Error('Invalid Gemini API key. Please check your key in Settings.'));
        }
        if (error.status === 429) {
          return throwError(() => new Error('Gemini rate limit exceeded. Please wait a moment and try again.'));
        }
        if (error.status >= 400) {
          return throwError(() => new Error(`Gemini API error: ${error.status}`));
        }
        return throwError(() => error);
      })
    );
  }
}
