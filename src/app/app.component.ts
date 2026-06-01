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
    return 'Dashboard';
  });

  constructor(router: Router) {
    this.currentUrl.set(router.url);
    router.events.pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd)).subscribe((event) => {
      this.currentUrl.set(event.urlAfterRedirects);
    });
  }
}
