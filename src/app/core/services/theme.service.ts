import { Injectable, effect, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark' | 'system';

const THEME_STORAGE_KEY = 'budgetpilot_theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly _mode = signal<ThemeMode>(this.readInitialMode());
  private readonly _isDark = signal<boolean>(false);

  readonly mode = this._mode.asReadonly();
  readonly isDark = this._isDark.asReadonly();

  constructor() {
    const mediaQuery =
      typeof window !== 'undefined' && window.matchMedia
        ? window.matchMedia('(prefers-color-scheme: dark)')
        : null;

    const applyTheme = () => {
      const mode = this._mode();
      const prefersDark = mediaQuery?.matches ?? false;
      const dark = mode === 'dark' || (mode === 'system' && prefersDark);
      this._isDark.set(dark);
      if (typeof document !== 'undefined') {
        document.documentElement.classList.toggle('dark', dark);
      }
    };

    effect(() => {
      const mode = this._mode();
      try {
        localStorage.setItem(THEME_STORAGE_KEY, mode);
      } catch {
        // Ignoré en navigation privée stricte
      }
      applyTheme();
    });

    mediaQuery?.addEventListener('change', () => {
      if (this._mode() === 'system') {
        applyTheme();
      }
    });
  }

  toggle(): void {
    this._mode.set(this._isDark() ? 'light' : 'dark');
  }

  setMode(mode: ThemeMode): void {
    this._mode.set(mode);
  }

  private readInitialMode(): ThemeMode {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        return saved;
      }
    } catch {
      // ignore
    }
    return 'system';
  }
}
