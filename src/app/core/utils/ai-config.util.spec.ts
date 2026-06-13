import { getActiveProvider, hasActiveApiKey, providerLabel } from './ai-config.util';

const PROVIDER_KEY = 'md_ai_provider_v1';
const CLAUDE_KEY = 'md_claude_api_key_v1';
const GEMINI_KEY = 'md_gemini_api_key_v1';

describe('ai-config.util', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  describe('getActiveProvider', () => {
    it('defaults to claude when nothing is saved', () => {
      expect(getActiveProvider()).toBe('claude');
    });

    it('returns the saved provider', () => {
      localStorage.setItem(PROVIDER_KEY, 'gemini');
      expect(getActiveProvider()).toBe('gemini');
    });
  });

  describe('hasActiveApiKey', () => {
    it('is false when no key is saved', () => {
      expect(hasActiveApiKey()).toBeFalse();
    });

    it('is true when the active (claude) provider has a key', () => {
      localStorage.setItem(CLAUDE_KEY, 'sk-123');
      expect(hasActiveApiKey()).toBeTrue();
    });

    it('checks the gemini key when gemini is active', () => {
      localStorage.setItem(PROVIDER_KEY, 'gemini');
      localStorage.setItem(CLAUDE_KEY, 'sk-123'); // wrong provider, ignored
      expect(hasActiveApiKey()).toBeFalse();
      localStorage.setItem(GEMINI_KEY, 'g-123');
      expect(hasActiveApiKey()).toBeTrue();
    });
  });

  describe('providerLabel', () => {
    it('labels claude and gemini', () => {
      expect(providerLabel('claude')).toBe('Claude');
      expect(providerLabel('gemini')).toBe('Gemini');
    });

    it('defaults to the active provider', () => {
      localStorage.setItem(PROVIDER_KEY, 'gemini');
      expect(providerLabel()).toBe('Gemini');
    });
  });
});
