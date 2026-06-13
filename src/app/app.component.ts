import { Component, computed, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';

import { DEMO_MENU } from './core/demo-data';
import { storageGet, storageRemove, storageSet } from './core/utils/storage.util';
import { ToastHostComponent } from './shared/components/toast-host/toast-host.component';

const MENU_KEY = 'md_angular_menu_v1';
const SALES_KEY = 'md_angular_sales_v1';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ToastHostComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  private readonly currentUrl = signal('/');
  private readonly _lsRevision = signal(0);

  readonly hasData = computed(() => {
    this._lsRevision();
    try {
      const menuItems = JSON.parse(storageGet(MENU_KEY) ?? 'null') ?? [];
      const salesData = JSON.parse(storageGet(SALES_KEY) ?? 'null') ?? {};
      return (Array.isArray(menuItems) && menuItems.length > 0) ||
             (typeof salesData === 'object' && salesData !== null && Object.keys(salesData).length > 0);
    } catch {
      return false;
    }
  });

  readonly hasMenu = computed(() => {
    this._lsRevision();
    try {
      const items = JSON.parse(storageGet(MENU_KEY) ?? 'null') ?? [];
      return Array.isArray(items) && items.length > 0;
    } catch {
      return false;
    }
  });

  readonly breadcrumb = computed(() => {
    const url = this.currentUrl();
    if (url.startsWith('/menu')) return 'Menu & Margin';
    if (url.startsWith('/sales-upload')) return 'Sales Analysis';
    if (url.startsWith('/how-it-works')) return 'How it works';
    if (url.startsWith('/settings')) return 'Settings';
    return 'Dashboard';
  });

  readonly confirmReset = signal(false);

  requestReset(): void {
    this.confirmReset.set(true);
  }

  cancelReset(): void {
    this.confirmReset.set(false);
  }

  resetSession(): void {
    storageRemove(MENU_KEY);
    storageRemove(SALES_KEY);
    window.location.reload();
  }

  loadDemo(): void {
    try {
      storageSet(MENU_KEY, JSON.stringify(DEMO_MENU));
    } catch { /* ignore */ }
    // _lsRevision is updated by the constructor listener when this event fires
    window.dispatchEvent(new CustomEvent('md:load-demo'));
  }

  readonly storageError = signal(false);

  constructor(private readonly router: Router) {
    this.currentUrl.set(router.url);
    router.events.pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd)).subscribe((event) => {
      this.currentUrl.set(event.urlAfterRedirects);
      // Re-read storage on navigation so cross-page changes (e.g. sales) update the session card.
      this._lsRevision.update((n) => n + 1);
    });
    // Any persisted change — demo load or manual edit — should refresh hasData so the
    // "Reset session" button appears as soon as there's data in the workspace.
    window.addEventListener('md:load-demo', () => this._lsRevision.update((n) => n + 1));
    window.addEventListener('md:data-changed', () => this._lsRevision.update((n) => n + 1));
    window.addEventListener('md:storage-error', () => this.storageError.set(true));
  }
}


