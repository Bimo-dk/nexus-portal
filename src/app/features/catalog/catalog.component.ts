import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CatalogService, type CatalogEntry } from './catalog.service';

@Component({
  selector: 'app-catalog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatTooltipModule,
  ],
  template: `
    <div class="page">
      <header>
        <div>
          <h1>Component Catalog</h1>
          <p>
            All components exposed by registered remotes, aggregated from per-remote
            <code>catalog.json</code>. Click a row to see how to use the component plus a live preview.
          </p>
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
          <input matInput placeholder="title, tags, expose..." [value]="query()"
                 (input)="query.set($any($event.target).value)" />
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
        <div class="table-wrap">
          <table mat-table [dataSource]="filtered()">
            <ng-container matColumnDef="title">
              <th mat-header-cell *matHeaderCellDef>Title</th>
              <td mat-cell *matCellDef="let e">
                <div class="title-cell">
                  <strong>{{ e.title }}</strong>
                  @if (e.experimental) { <span class="pill warn">experimental</span> }
                </div>
              </td>
            </ng-container>

            <ng-container matColumnDef="remote">
              <th mat-header-cell *matHeaderCellDef>Remote / Expose</th>
              <td mat-cell *matCellDef="let e">
                <code class="path">{{ e.remote }}<span class="sep">/</span>{{ e.expose }}</code>
              </td>
            </ng-container>

            <ng-container matColumnDef="category">
              <th mat-header-cell *matHeaderCellDef>Category</th>
              <td mat-cell *matCellDef="let e">
                @if (e.category) { <span class="pill cat">{{ e.category }}</span> } @else { <span class="muted">—</span> }
              </td>
            </ng-container>

            <ng-container matColumnDef="tags">
              <th mat-header-cell *matHeaderCellDef>Tags</th>
              <td mat-cell *matCellDef="let e">
                <span class="chips">
                  @for (t of e.tags; track t) { <span class="pill">{{ t }}</span> } @empty { <span class="muted">—</span> }
                </span>
              </td>
            </ng-container>

            <ng-container matColumnDef="inputs">
              <th mat-header-cell *matHeaderCellDef>Inputs</th>
              <td mat-cell *matCellDef="let e">
                <span class="muted">{{ inputCount(e) }}</span>
              </td>
            </ng-container>

            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef></th>
              <td mat-cell *matCellDef="let e">
                <button mat-icon-button matTooltip="Open details" (click)="open(e); $event.stopPropagation()">
                  <mat-icon>chevron_right</mat-icon>
                </button>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="displayed"></tr>
            <tr mat-row *matRowDef="let row; columns: displayed" class="clickable" (click)="open(row)"></tr>
          </table>
          @if (filtered().length === 0) {
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
    header p { margin: 4px 0 0; font-size: 13px; color: rgba(0,0,0,0.6); max-width: 720px; }
    header p code { background: #f1f5f9; padding: 1px 6px; border-radius: 4px; font-size: 11px; }
    header .actions { display: flex; align-items: center; gap: 8px; }
    header .meta { font-size: 12px; color: rgba(0,0,0,0.5); }

    .filters { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; margin-bottom: 16px; padding: 8px; background: #f8fafc; border-radius: 10px; }
    .filters mat-form-field { min-width: 160px; }
    .filters .count { margin-left: auto; padding: 0 8px; font-size: 12px; color: rgba(0,0,0,0.6); font-variant-numeric: tabular-nums; }

    .table-wrap { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; }
    table { width: 100%; }
    .clickable { cursor: pointer; transition: background 0.1s; }
    .clickable:hover { background: #eef2ff; }
    .title-cell { display: flex; align-items: center; gap: 8px; }
    .path { font-family: monospace; font-size: 12px; color: #475569; }
    .path .sep { color: #cbd5e1; padding: 0 2px; }
    .chips { display: inline-flex; flex-wrap: wrap; gap: 4px; }
    .muted { color: rgba(0,0,0,0.4); font-size: 12px; }

    .pill { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 10px; background: #e2e8f0; color: #475569; }
    .pill.cat { background: #eef2ff; color: #4338ca; font-weight: 600; }
    .pill.warn { background: #fef3c7; color: #92400e; }

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
  private readonly router = inject(Router);

  readonly query = signal<string>('');
  readonly category = signal<string>('');
  readonly remote = signal<string>('');
  readonly tag = signal<string>('');

  readonly displayed = ['title', 'remote', 'category', 'tags', 'inputs', 'actions'];

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

  open(e: CatalogEntry): void {
    void this.router.navigate(['/catalog', e.remote, encodeURIComponent(e.expose)]);
  }

  errorEntries(): Array<{ key: string; value: string }> {
    return Array.from(this.catalog.errors().entries()).map(([key, value]) => ({ key, value }));
  }
}
