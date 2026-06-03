import { Component, computed, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  private readonly currentUrl = signal('/');

  readonly breadcrumb = computed(() => {
    const url = this.currentUrl();
    if (url.startsWith('/menu')) return 'Menu & Margin';
    if (url.startsWith('/sales-upload')) return 'Sales Analysis';
    if (url.startsWith('/how-it-works')) return 'How it works';
    if (url.startsWith('/settings')) return 'Settings';
    return 'Dashboard';
  });

  resetSession(): void {
    localStorage.removeItem('md_angular_menu_v1');
    localStorage.removeItem('md_angular_sales_v1');
    window.location.reload();
  }

  constructor(router: Router) {
    this.currentUrl.set(router.url);
    router.events.pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd)).subscribe((event) => {
      this.currentUrl.set(event.urlAfterRedirects);
    });
  }
}


