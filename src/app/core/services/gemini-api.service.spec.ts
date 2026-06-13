import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { lastValueFrom } from 'rxjs';

import { GeminiApiService } from './gemini-api.service';

const KEY = 'md_gemini_api_key_v1';
const URL_PREFIX = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

describe('GeminiApiService', () => {
  let service: GeminiApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(GeminiApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  function call() {
    return lastValueFrom(service.call({ systemPrompt: 's', userPrompt: 'u' }));
  }

  it('errors without a request when no key is configured', async () => {
    await expectAsync(call()).toBeRejectedWithError(/Gemini API key not configured/);
    httpMock.expectNone(() => true);
  });

  it('returns the candidate text on success', async () => {
    localStorage.setItem(KEY, 'g-123');
    const promise = call();
    const req = httpMock.expectOne((r) => r.url.startsWith(URL_PREFIX));
    expect(req.request.url).toContain('key=g-123');
    req.flush({ candidates: [{ content: { parts: [{ text: 'hi' }] } }] });
    await expectAsync(promise).toBeResolvedTo('hi');
  });

  it('maps a 403 to an invalid-key message', async () => {
    localStorage.setItem(KEY, 'bad');
    const promise = call();
    httpMock.expectOne((r) => r.url.startsWith(URL_PREFIX)).flush({}, { status: 403, statusText: 'Forbidden' });
    await expectAsync(promise).toBeRejectedWithError(/Invalid Gemini API key/);
  });

  it('maps a 429 to a rate-limit message', async () => {
    localStorage.setItem(KEY, 'g-123');
    const promise = call();
    httpMock.expectOne((r) => r.url.startsWith(URL_PREFIX)).flush({}, { status: 429, statusText: 'Too Many' });
    await expectAsync(promise).toBeRejectedWithError(/Gemini rate limit exceeded/);
  });
});
