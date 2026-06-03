import { CommonModule } from '@angular/common';
import { Component, computed, signal } from '@angular/core';

const CLAUDE_KEY = 'md_claude_api_key_v1';
const CLAUDE_MODEL = 'md_claude_model_v1';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss'
})
export class SettingsComponent {
  readonly savedApiKey = signal(localStorage.getItem(CLAUDE_KEY) || '');
  readonly draftKey = signal(localStorage.getItem(CLAUDE_KEY) || '');
  readonly model = signal(localStorage.getItem(CLAUDE_MODEL) || 'claude-sonnet-4-5');
  readonly showKey = signal(false);
  readonly savedFlash = signal(false);

  readonly connected = computed(() => !!this.savedApiKey());
  readonly keyLooksValid = computed(() => /^sk-ant-[A-Za-z0-9_-]{10,}$/.test(this.draftKey().trim()));
  readonly keyDirty = computed(() => this.draftKey().trim() !== this.savedApiKey());
  readonly canSave = computed(() => this.keyDirty() && this.draftKey().trim() !== '');

  readonly maskedPreview = computed(() => {
    const key = this.savedApiKey();
    if (!key) return '';
    return key.slice(0, 7) + '…' + key.slice(-4);
  });

  updateDraftKey(value: string): void {
    this.draftKey.set(value);
  }

  updateModel(value: string): void {
    this.model.set(value);
    localStorage.setItem(CLAUDE_MODEL, value);
  }

  toggleKeyVisibility(): void {
    this.showKey.set(!this.showKey());
  }

  saveKey(): void {
    const trimmed = this.draftKey().trim();
    this.savedApiKey.set(trimmed);
    localStorage.setItem(CLAUDE_KEY, trimmed);
    localStorage.setItem(CLAUDE_MODEL, this.model());
    this.savedFlash.set(true);
    setTimeout(() => this.savedFlash.set(false), 2000);
  }

  removeKey(): void {
    this.draftKey.set('');
    this.savedApiKey.set('');
    localStorage.removeItem(CLAUDE_KEY);
  }
}
