import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
    title: 'Dashboard - Margin Delver'
  },
  {
    path: 'menu',
    loadComponent: () =>
      import('./features/landing/landing.component').then((m) => m.LandingComponent),
    title: 'Menu & Margin - Margin Delver'
  },
  {
    path: 'sales-upload',
    loadComponent: () =>
      import('./features/sales-upload/sales-upload.component').then((m) => m.SalesUploadComponent),
    title: 'Sales Analysis - Margin Delver'
  },
  {
    path: 'how-it-works',
    loadComponent: () =>
      import('./features/how-it-works/how-it-works.component').then((m) => m.HowItWorksComponent),
    title: 'How it works - Margin Delver'
  },
  {
    path: 'settings',
    loadComponent: () =>
      import('./features/settings/settings.component').then((m) => m.SettingsComponent),
    title: 'Settings - Margin Delver'
  },
  {
    path: '**',
    redirectTo: ''
  }
];


