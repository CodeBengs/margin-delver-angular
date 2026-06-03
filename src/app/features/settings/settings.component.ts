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
  readonly apiKey = signal(localStorage.getItem(CLAUDE_KEY) || '');
  readonly model = signal(localStorage.getItem(CLAUDE_MODEL) || 'claude-3-5-sonnet-latest');
  readonly showKey = signal(false);
  readonly saved = signal(false);

  readonly connected = computed(() => this.apiKey().startsWith('sk-ant-'));
  readonly maskedKey = computed(() => {
    const key = this.apiKey();
    if (!key) return '';
    if (this.showKey()) return key;
    return key.length > 12 ? `${key.slice(0, 11)}...` : key;
  });

  updateApiKey(value: string): void {
    this.apiKey.set(value.trim());
    this.saved.set(false);
  }

  updateModel(value: string): void {
    this.model.set(value);
    localStorage.setItem(CLAUDE_MODEL, value);
  }

  toggleKeyVisibility(): void {
    this.showKey.set(!this.showKey());
  }

  saveKey(): void {
    localStorage.setItem(CLAUDE_KEY, this.apiKey());
    localStorage.setItem(CLAUDE_MODEL, this.model());
    this.saved.set(true);
  }

  clearKey(): void {
    this.apiKey.set('');
    localStorage.removeItem(CLAUDE_KEY);
    this.saved.set(false);
  }
}
