import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'nexus-portal-theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly _current = new BehaviorSubject<Theme>(this.read());

  readonly currentTheme$ = this._current.asObservable();

  get current(): Theme {
    return this._current.value;
  }

  init(): void {
    this.apply(this._current.value);
  }

  toggle(): void {
    const next: Theme = this._current.value === 'dark' ? 'light' : 'dark';
    this.set(next);
  }

  set(theme: Theme): void {
    localStorage.setItem(STORAGE_KEY, theme);
    this._current.next(theme);
    this.apply(theme);
  }

  private apply(theme: Theme): void {
    document.documentElement.setAttribute('data-theme', theme);
  }

  private read(): Theme {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (stored === 'dark' || stored === 'light') return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
}
