import { CommonModule } from '@angular/common';
import { Component, computed, signal } from '@angular/core';

import { storageGet, storageRemove, storageSet } from '../../core/utils/storage.util';

const CLAUDE_KEY     = 'md_claude_api_key_v1';
const CLAUDE_MODEL   = 'md_claude_model_v1';
const GEMINI_KEY     = 'md_gemini_api_key_v1';
const AI_PROVIDER    = 'md_ai_provider_v1';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss'
})
export class SettingsComponent {
  // Provider
  readonly provider = signal<'claude' | 'gemini'>(
    (storageGet(AI_PROVIDER) as 'claude' | 'gemini') ?? 'claude'
  );

  // Claude
  readonly savedApiKey   = signal(storageGet(CLAUDE_KEY) || '');
  readonly draftKey      = signal(storageGet(CLAUDE_KEY) || '');
  readonly model         = signal(storageGet(CLAUDE_MODEL) || 'claude-sonnet-4-6');
  readonly showKey       = signal(false);
  readonly savedFlash    = signal(false);

  // Gemini
  readonly savedGeminiKey  = signal(storageGet(GEMINI_KEY) || '');
  readonly draftGeminiKey  = signal(storageGet(GEMINI_KEY) || '');
  readonly showGeminiKey   = signal(false);
  readonly savedGeminiFlash = signal(false);

  // Computed — Claude
  readonly claudeConnected  = computed(() => !!this.savedApiKey());
  readonly keyLooksValid    = computed(() => /^sk-ant-[A-Za-z0-9_-]{10,}$/.test(this.draftKey().trim()));
  readonly keyDirty         = computed(() => this.draftKey().trim() !== this.savedApiKey());
  readonly canSave          = computed(() => this.keyDirty() && this.draftKey().trim() !== '');
  readonly maskedPreview    = computed(() => {
    const key = this.savedApiKey();
    return key ? key.slice(0, 7) + '…' + key.slice(-4) : '';
  });

  // Computed — Gemini
  readonly geminiConnected     = computed(() => !!this.savedGeminiKey());
  readonly geminiKeyLooksValid = computed(() => /^AIza[A-Za-z0-9_-]{30,}$/.test(this.draftGeminiKey().trim()));
  readonly geminiKeyDirty      = computed(() => this.draftGeminiKey().trim() !== this.savedGeminiKey());
  readonly canSaveGemini       = computed(() => this.geminiKeyDirty() && this.draftGeminiKey().trim() !== '');
  readonly maskedGeminiPreview = computed(() => {
    const key = this.savedGeminiKey();
    return key ? key.slice(0, 6) + '…' + key.slice(-4) : '';
  });

  // Active connection badge
  readonly connected = computed(() =>
    this.provider() === 'gemini' ? this.geminiConnected() : this.claudeConnected()
  );

  readonly saveError = signal('');

  // Provider
  updateProvider(value: 'claude' | 'gemini'): void {
    this.provider.set(value);
    storageSet(AI_PROVIDER, value);
  }

  // Claude methods
  updateDraftKey(value: string): void { this.draftKey.set(value); }
  toggleKeyVisibility(): void { this.showKey.set(!this.showKey()); }

  saveKey(): void {
    const trimmed = this.draftKey().trim();
    const ok = storageSet(CLAUDE_KEY, trimmed) && storageSet(CLAUDE_MODEL, this.model());
    if (!ok) { window.dispatchEvent(new CustomEvent('md:storage-error')); return; }
    this.savedApiKey.set(trimmed);
    this.saveError.set('');
    this.savedFlash.set(true);
    setTimeout(() => this.savedFlash.set(false), 2000);
  }

  removeKey(): void {
    this.draftKey.set('');
    this.savedApiKey.set('');
    storageRemove(CLAUDE_KEY);
  }

  updateModel(value: string): void {
    this.model.set(value);
    storageSet(CLAUDE_MODEL, value);
  }

  // Gemini methods
  updateDraftGeminiKey(value: string): void { this.draftGeminiKey.set(value); }
  toggleGeminiKeyVisibility(): void { this.showGeminiKey.set(!this.showGeminiKey()); }

  saveGeminiKey(): void {
    const trimmed = this.draftGeminiKey().trim();
    const ok = storageSet(GEMINI_KEY, trimmed);
    if (!ok) { window.dispatchEvent(new CustomEvent('md:storage-error')); return; }
    this.savedGeminiKey.set(trimmed);
    this.saveError.set('');
    this.savedGeminiFlash.set(true);
    setTimeout(() => this.savedGeminiFlash.set(false), 2000);
  }

  removeGeminiKey(): void {
    this.draftGeminiKey.set('');
    this.savedGeminiKey.set('');
    storageRemove(GEMINI_KEY);
  }
}
