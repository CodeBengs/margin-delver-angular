import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { lastValueFrom } from 'rxjs';

import { ClaudeApiService } from './claude-api.service';

const URL = 'https://api.anthropic.com/v1/messages';
const KEY = 'md_claude_api_key_v1';

describe('ClaudeApiService', () => {
  let service: ClaudeApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(ClaudeApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  function call() {
    return lastValueFrom(service.call({ systemPrompt: 's', userPrompt: 'u' }));
  }

  it('errors without making a request when no API key is configured', async () => {
    await expectAsync(call()).toBeRejectedWithError(/API key not configured/);
    httpMock.expectNone(URL);
  });

  it('returns the response text on success', async () => {
    localStorage.setItem(KEY, 'sk-123');
    const promise = call();
    const req = httpMock.expectOne(URL);
    expect(req.request.headers.get('x-api-key')).toBe('sk-123');
    req.flush({ content: [{ type: 'text', text: 'hello' }] });
    await expectAsync(promise).toBeResolvedTo('hello');
  });

  it('maps a 401 to an invalid-key message', async () => {
    localStorage.setItem(KEY, 'bad');
    const promise = call();
    httpMock.expectOne(URL).flush({}, { status: 401, statusText: 'Unauthorized' });
    await expectAsync(promise).toBeRejectedWithError(/Invalid API key/);
  });

  it('maps a 429 to a rate-limit message', async () => {
    localStorage.setItem(KEY, 'sk-123');
    const promise = call();
    httpMock.expectOne(URL).flush({}, { status: 429, statusText: 'Too Many Requests' });
    await expectAsync(promise).toBeRejectedWithError(/Rate limit exceeded/);
  });

  it('maps other 4xx/5xx to a generic API error', async () => {
    localStorage.setItem(KEY, 'sk-123');
    const promise = call();
    httpMock.expectOne(URL).flush({}, { status: 500, statusText: 'Server Error' });
    await expectAsync(promise).toBeRejectedWithError(/Claude API error: 500/);
  });
});
