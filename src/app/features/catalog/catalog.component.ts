import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { CatalogService, type CatalogEntry } from './catalog.service';

@Component({
  selector: 'app-catalog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  template: `
    <div class="page">
      <header>
        <div>
          <h1>Component Catalog</h1>
          <p>All components exposed by registered remotes, aggregated from per-remote <code>catalog.json</code>.</p>
        </div>
        <div class="actions">
          @if (catalog.lastRefresh(); as t) {
            <span class="meta">Last refresh: {{ t | date: 'mediumTime' }}</span>
          }
          <button mat-stroked-button (click)="reload()" [disabled]="catalog.loading()">
            <mat-icon>refresh</mat-icon> Refresh
          </button>
        </div>
      </header>

      <section class="filters">
        <mat-form-field appearance="outline">
          <mat-label>Search</mat-label>
          <input matInput placeholder="title, tags, expose..." [value]="query()" (input)="query.set($any($event.target).value)" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Category</mat-label>
          <mat-select [value]="category()" (selectionChange)="category.set($any($event.value))">
            <mat-option value="">All</mat-option>
            @for (c of catalog.categories(); track c) { <mat-option [value]="c">{{ c }}</mat-option> }
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Remote</mat-label>
          <mat-select [value]="remote()" (selectionChange)="remote.set($any($event.value))">
            <mat-option value="">All</mat-option>
            @for (r of catalog.remotes(); track r) { <mat-option [value]="r">{{ r }}</mat-option> }
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Tag</mat-label>
          <mat-select [value]="tag()" (selectionChange)="tag.set($any($event.value))">
            <mat-option value="">Any</mat-option>
            @for (t of catalog.tags(); track t) { <mat-option [value]="t">{{ t }}</mat-option> }
          </mat-select>
        </mat-form-field>

        <span class="count">{{ filtered().length }} of {{ catalog.entries().length }}</span>
      </section>

      @if (catalog.loading()) {
        <p class="hint">Loading...</p>
      } @else if (catalog.entries().length === 0) {
        <p class="hint empty">
          No catalog entries. Annotate components with <code>&#64;NexusComponent({{ '{' }} title: '...' {{ '}' }})</code>
          and rebuild the remote.
        </p>
      } @else {
        <div class="grid">
          @for (e of filtered(); track e.remote + ':' + e.expose) {
            <mat-card class="entry">
              <mat-card-header>
                @if (e.icon) { <mat-icon mat-card-avatar>{{ e.icon }}</mat-icon> }
                <mat-card-title>{{ e.title }}</mat-card-title>
                <mat-card-subtitle>
                  <code>{{ e.remote }}/{{ e.expose }}</code>
                  @if (e.experimental) { <span class="pill warn">experimental</span> }
                </mat-card-subtitle>
              </mat-card-header>
              <mat-card-content>
                @if (e.description) { <p class="desc">{{ e.description }}</p> }
                <div class="chips">
                  @if (e.category) { <span class="pill cat">{{ e.category }}</span> }
                  @for (t of e.tags; track t) { <span class="pill">{{ t }}</span> }
                </div>
                @if (inputCount(e) > 0) {
                  <details>
                    <summary>{{ inputCount(e) }} input(s)</summary>
                    <table class="inputs">
                      <thead>
                        <tr><th>Name</th><th>Type</th><th>Default</th><th>Description</th></tr>
                      </thead>
                      <tbody>
                        @for (kv of inputEntries(e); track kv.name) {
                          <tr>
                            <td><code>{{ kv.name }}</code>@if (kv.spec.required) { <sup>*</sup> }</td>
                            <td><code>{{ kv.spec.type }}</code></td>
                            <td><code>{{ kv.spec.default !== undefined ? kv.spec.default : '—' }}</code></td>
                            <td>{{ kv.spec.description || '' }}</td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </details>
                }
              </mat-card-content>
            </mat-card>
          } @empty {
            <p class="hint empty">No components match the filters.</p>
          }
        </div>
      }

      @if (catalog.errors().size > 0) {
        <section class="errors">
          <h3>Errors</h3>
          @for (kv of errorEntries(); track kv.key) {
            <p><code>{{ kv.key }}</code>: {{ kv.value }}</p>
          }
        </section>
      }
    </div>
  `,
  styles: [`
    .page { padding: 24px; max-width: 1400px; margin: 0 auto; }
    header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; gap: 16px; flex-wrap: wrap; }
    header h1 { margin: 0; font-size: 22px; }
    header p { margin: 4px 0 0; font-size: 13px; color: rgba(0,0,0,0.6); }
    header p code { background: #f1f5f9; padding: 1px 6px; border-radius: 4px; font-size: 11px; }
    header .actions { display: flex; align-items: center; gap: 8px; }
    header .meta { font-size: 12px; color: rgba(0,0,0,0.5); }

    .filters { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; margin-bottom: 16px; padding: 8px; background: #f8fafc; border-radius: 10px; }
    .filters mat-form-field { min-width: 160px; }
    .filters .count { margin-left: auto; padding: 0 8px; font-size: 12px; color: rgba(0,0,0,0.6); font-variant-numeric: tabular-nums; }

    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; }
    .entry mat-card-subtitle code { font-family: monospace; font-size: 11px; }
    .desc { margin: 8px 0; font-size: 13px; color: rgba(0,0,0,0.7); }
    .chips { display: flex; flex-wrap: wrap; gap: 4px; margin: 8px 0; }

    .pill { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 10px; background: #e2e8f0; color: #475569; }
    .pill.cat { background: #eef2ff; color: #4338ca; font-weight: 600; }
    .pill.warn { background: #fef3c7; color: #92400e; margin-left: 6px; }

    details { margin-top: 8px; font-size: 12px; }
    details summary { cursor: pointer; color: #6366f1; padding: 4px 0; }
    table.inputs { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 11px; }
    table.inputs th, table.inputs td { padding: 4px 8px; text-align: left; border-bottom: 1px solid #f1f5f9; }
    table.inputs code { font-family: monospace; }

    .hint { padding: 32px; text-align: center; color: rgba(0,0,0,0.5); }
    .hint.empty code { font-family: monospace; background: #f1f5f9; padding: 2px 6px; border-radius: 4px; }

    .errors { margin-top: 16px; padding: 12px 16px; background: #fef3c7; border-radius: 8px; }
    .errors h3 { margin: 0 0 6px; font-size: 13px; color: #92400e; }
    .errors p { margin: 2px 0; font-size: 12px; }
    .errors code { font-family: monospace; }
  `],
})
export class CatalogComponent implements OnInit {
  readonly catalog = inject(CatalogService);

  readonly query = signal<string>('');
  readonly category = signal<string>('');
  readonly remote = signal<string>('');
  readonly tag = signal<string>('');

  readonly filtered = computed<CatalogEntry[]>(() =>
    this.catalog.filter({
      query: this.query(),
      category: this.category() || undefined,
      remote: this.remote() || undefined,
      tag: this.tag() || undefined,
    }),
  );

  async ngOnInit(): Promise<void> {
    await this.catalog.refresh();
  }

  async reload(): Promise<void> {
    await this.catalog.refresh();
  }

  inputCount(e: CatalogEntry): number {
    return Object.keys(e.inputs).length;
  }

  inputEntries(e: CatalogEntry): Array<{ name: string; spec: CatalogEntry['inputs'][string] }> {
    return Object.entries(e.inputs).map(([name, spec]) => ({ name, spec }));
  }

  errorEntries(): Array<{ key: string; value: string }> {
    return Array.from(this.catalog.errors().entries()).map(([key, value]) => ({ key, value }));
  }
}
