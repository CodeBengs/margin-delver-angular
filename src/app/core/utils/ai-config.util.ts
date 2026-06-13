import { storageGet } from './storage.util';

export type AiProvider = 'claude' | 'gemini';

const PROVIDER_KEY = 'md_ai_provider_v1';
const CLAUDE_KEY = 'md_claude_api_key_v1';
const GEMINI_KEY = 'md_gemini_api_key_v1';

/** The AI provider the user has selected in Settings (defaults to Claude). */
export function getActiveProvider(): AiProvider {
  return (storageGet(PROVIDER_KEY) as AiProvider) ?? 'claude';
}

/** True when the active provider has an API key saved in Settings. */
export function hasActiveApiKey(): boolean {
  const key = getActiveProvider() === 'gemini' ? storageGet(GEMINI_KEY) : storageGet(CLAUDE_KEY);
  return !!key;
}

/** Human-readable name for a provider, for use in messages. */
export function providerLabel(provider: AiProvider = getActiveProvider()): string {
  return provider === 'gemini' ? 'Gemini' : 'Claude';
}
