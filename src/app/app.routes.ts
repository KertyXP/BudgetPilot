import { Routes } from '@angular/router';
import { projectGuard } from './core/guards/project.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/auth-projects/auth-projects.component').then(
        (m) => m.AuthProjectsComponent,
      ),
    pathMatch: 'full',
  },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
    canActivate: [projectGuard],
  },
  {
    path: 'pareto',
    loadComponent: () =>
      import('./features/pareto/pareto.component').then((m) => m.ParetoComponent),
    canActivate: [projectGuard],
  },
  {
    path: 'transactions',
    loadComponent: () =>
      import('./features/transactions/transactions.component').then(
        (m) => m.TransactionsComponent,
      ),
    canActivate: [projectGuard],
  },
  {
    path: 'rules',
    loadComponent: () =>
      import('./features/rules/rules.component').then((m) => m.RulesComponent),
    canActivate: [projectGuard],
  },
  {
    path: 'import',
    loadComponent: () =>
      import('./features/import-csv/import-csv.component').then((m) => m.ImportCsvComponent),
    canActivate: [projectGuard],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
