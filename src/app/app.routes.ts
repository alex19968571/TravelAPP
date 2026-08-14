import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'join/:code',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/trips/join-trip.component').then((m) => m.JoinTripComponent),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./core/layout/app-shell.component').then((m) => m.AppShellComponent),
    children: [
      { path: '', redirectTo: 'trips', pathMatch: 'full' },
      {
        path: 'trips',
        loadComponent: () =>
          import('./features/trips/trips-list.component').then((m) => m.TripsListComponent),
      },
      {
        path: 'trips/:id',
        loadComponent: () =>
          import('./features/trips/trip-detail.component').then((m) => m.TripDetailComponent),
      },
      {
        path: 'trips/:id/itinerary',
        loadComponent: () =>
          import('./features/itinerary/itinerary.component').then((m) => m.ItineraryComponent),
      },
      {
        path: 'trips/:id/shopping',
        loadComponent: () =>
          import('./features/shopping/shopping-list.component').then(
            (m) => m.ShoppingListComponent,
          ),
      },
      {
        path: 'trips/:id/expenses',
        loadComponent: () =>
          import('./features/expenses/expenses.component').then((m) => m.ExpensesComponent),
      },
      {
        path: 'trips/:id/members',
        loadComponent: () =>
          import('./features/trips/trip-members.component').then((m) => m.TripMembersComponent),
      },
      {
        path: 'trips/:id/scrapbook',
        loadComponent: () =>
          import('./features/trips/trip-scrapbook.component').then(
            (m) => m.TripScrapbookComponent,
          ),
      },
      {
        path: 'exchange',
        loadComponent: () =>
          import('./features/exchange/exchange.component').then((m) => m.ExchangeComponent),
      },
      {
        path: 'flight-watch',
        loadComponent: () =>
          import('./features/flight-watch/flight-watch.component').then(
            (m) => m.FlightWatchComponent,
          ),
      },
      {
        path: 'account',
        loadComponent: () =>
          import('./features/account/account.component').then((m) => m.AccountComponent),
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/settings/settings.component').then((m) => m.SettingsComponent),
      },
    ],
  },
  { path: '**', redirectTo: 'trips' },
];
