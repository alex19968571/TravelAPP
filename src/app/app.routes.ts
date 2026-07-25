import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'trips', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login.component').then(m => m.LoginComponent),
  },
  {
    path: 'trips',
    canActivate: [authGuard],
    loadComponent: () => import('./features/trips/trips-list.component').then(m => m.TripsListComponent),
  },
  {
    path: 'trips/:id',
    canActivate: [authGuard],
    loadComponent: () => import('./features/trips/trip-detail.component').then(m => m.TripDetailComponent),
  },
  {
    path: 'trips/:id/itinerary',
    canActivate: [authGuard],
    loadComponent: () => import('./features/itinerary/itinerary.component').then(m => m.ItineraryComponent),
  },
  {
    path: 'trips/:id/shopping',
    canActivate: [authGuard],
    loadComponent: () => import('./features/shopping/shopping-list.component').then(m => m.ShoppingListComponent),
  },
  {
    path: 'trips/:id/expenses',
    canActivate: [authGuard],
    loadComponent: () => import('./features/expenses/expenses.component').then(m => m.ExpensesComponent),
  },
  {
    path: 'settings',
    canActivate: [authGuard],
    loadComponent: () => import('./features/settings/settings.component').then(m => m.SettingsComponent),
  },
  { path: '**', redirectTo: 'trips' },
];
