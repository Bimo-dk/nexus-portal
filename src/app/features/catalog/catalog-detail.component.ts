import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CatalogService, type CatalogEntry } from './catalog.service';

/**
 * Catalog detail page. Shows everything a developer needs to consume
 * a federated component:
 *
 *   - metadata (title, description, category, tags, inputs)
 *   - implementation code snippets for each host framework, with a
 *     copy button
 *   - a live preview that mounts the actual remote inside a sandboxed
 *     div via the BYOF mount(el) export
 */
@Component({
  selector: 'app-catalog-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatTabsModule,
    MatTooltipModule,
  ],
  template: `
    <div class="page">
      <nav class="crumbs">
        <a routerLink="/catalog">Component Catalog</a>
        <mat-icon>chevron_right</mat-icon>
        <span>{{ remote() }} <span class="sep">/</span> {{ expose() }}</span>
      </nav>

      @if (entry(); as e) {
        <header class="hero">
          <div>
            <h1>{{ e.title }}</h1>
            @if (e.description) { <p class="lead">{{ e.description }}</p> }
            <div class="chips">
              @if (e.category) { <span class="pill cat">{{ e.category }}</span> }
              @for (t of e.tags; track t) { <span class="pill">{{ t }}</span> }
              @if (e.experimental) { <span class="pill warn">experimental</span> }
            </div>
          </div>
          <div class="ident">
            <span class="label">Remote</span><strong>{{ e.remote }}</strong>
            <span class="label">Expose</span><code>{{ e.expose }}</code>
          </div>
        </header>

        <div class="grid">
          <section class="preview-pane">
            <header class="pane-header">
              <strong>Live preview</strong>
              <button mat-stroked-button (click)="remount()">
                <mat-icon>refresh</mat-icon> Re-mount
              </button>
            </header>
            <div class="preview-frame">
              @if (previewError()) {
                <div class="err">
                  <strong>Could not mount component:</strong>
                  <p>{{ previewError() }}</p>
                </div>
              }
              <div #previewHost class="preview-host"></div>
            </div>
          </section>

          <section>
            <mat-tab-group dynamicHeight>
              <mat-tab label="Angular host">
                <pre class="code"><code>{{ angularSnippet(e) }}</code></pre>
                <button mat-stroked-button (click)="copy(angularSnippet(e))">
                  <mat-icon>content_copy</mat-icon> Copy
                </button>
              </mat-tab>
              <mat-tab label="Vue host">
                <pre class="code"><code>{{ vueSnippet(e) }}</code></pre>
                <button mat-stroked-button (click)="copy(vueSnippet(e))">
                  <mat-icon>content_copy</mat-icon> Copy
                </button>
              </mat-tab>
              <mat-tab label="React host">
                <pre class="code"><code>{{ reactSnippet(e) }}</code></pre>
                <button mat-stroked-button (click)="copy(reactSnippet(e))">
                  <mat-icon>content_copy</mat-icon> Copy
                </button>
              </mat-tab>
              <mat-tab label="Plain JS">
                <pre class="code"><code>{{ vanillaSnippet(e) }}</code></pre>
                <button mat-stroked-button (click)="copy(vanillaSnippet(e))">
                  <mat-icon>content_copy</mat-icon> Copy
                </button>
              </mat-tab>
            </mat-tab-group>

            @if (inputEntries(e).length > 0) {
              <section class="inputs">
                <h3>Inputs</h3>
                <table>
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
              </section>
            }
          </section>
        </div>
      } @else if (catalog.loading()) {
        <p class="hint">Loading catalog...</p>
      } @else {
        <p class="hint empty">
          Component not found.
          <a routerLink="/catalog">Back to catalog</a>.
        </p>
      }
    </div>
  `,
  styles: [`
    .page { padding: 24px; max-width: 1400px; margin: 0 auto; }
    .crumbs { display: flex; align-items: center; gap: 4px; color: rgba(0,0,0,0.5); font-size: 13px; margin-bottom: 12px; }
    .crumbs a { color: #6366f1; text-decoration: none; }
    .crumbs .sep { color: #cbd5e1; padding: 0 2px; }
    .crumbs mat-icon { font-size: 14px; width: 14px; height: 14px; }

    .hero {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 24px;
      padding: 24px;
      background: linear-gradient(135deg, #1e3a8a 0%, #3730a3 100%);
      color: white;
      border-radius: 14px;
      margin-bottom: 24px;
    }
    .hero h1 { margin: 0; font-size: 24px; }
    .hero .lead { margin: 6px 0 12px; opacity: 0.85; line-height: 1.5; }
    .hero .chips { display: flex; gap: 6px; flex-wrap: wrap; }
    .hero .ident { display: grid; grid-template-columns: auto auto; gap: 4px 12px; align-items: center; font-size: 13px; }
    .hero .ident .label { color: rgba(255,255,255,0.6); }
    .hero .ident strong, .hero .ident code { color: white; font-family: monospace; }

    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    @media (max-width: 1024px) { .grid { grid-template-columns: 1fr; } }

    .pane-header { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
    .pane-header strong { font-size: 14px; text-transform: uppercase; letter-spacing: 1px; color: rgba(0,0,0,0.6); }
    .pane-header button { margin-left: auto; }

    .preview-frame {
      min-height: 240px;
      padding: 24px;
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
    }
    .preview-host { display: block; }
    .err { color: #b91c1c; background: #fee2e2; padding: 12px; border-radius: 8px; font-size: 13px; }
    .err p { margin: 4px 0 0; }

    pre.code {
      background: #0f172a;
      color: #e2e8f0;
      padding: 16px;
      border-radius: 8px;
      overflow-x: auto;
      font-size: 12.5px;
      line-height: 1.55;
    }

    .inputs { margin-top: 16px; }
    .inputs h3 { font-size: 13px; text-transform: uppercase; letter-spacing: 1px; color: rgba(0,0,0,0.6); margin: 0 0 6px; }
    .inputs table { width: 100%; border-collapse: collapse; font-size: 12px; }
    .inputs th, .inputs td { padding: 6px 8px; text-align: left; border-bottom: 1px solid #f1f5f9; }
    .inputs code { font-family: monospace; }

    .pill { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 11px; background: rgba(255,255,255,0.18); color: rgba(255,255,255,0.95); }
    .pill.cat { background: rgba(255,255,255,0.25); font-weight: 600; }
    .pill.warn { background: #fef3c7; color: #92400e; }

    .hint { padding: 32px; text-align: center; color: rgba(0,0,0,0.5); }
    .hint a { color: #6366f1; }
  `],
})
export class CatalogDetailComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly catalog = inject(CatalogService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly remote = signal<string>('');
  readonly expose = signal<string>('');
  readonly previewError = signal<string | null>(null);

  readonly entry = computed<CatalogEntry | null>(() => {
    const list = this.catalog.entries();
    return list.find((e) => e.remote === this.remote() && e.expose === this.expose()) ?? null;
  });

  @ViewChild('previewHost', { read: ElementRef })
  previewHost?: ElementRef<HTMLElement>;

  private teardown?: () => void;
  private readonly viewReady = signal(false);

  constructor() {
    // Re-mount whenever both the entry (driven by catalog refresh) and
    // the view (driven by ngAfterViewInit) are ready. Avoids the race
    // where ngAfterViewInit runs before the catalog fetch completes
    // and the entry() signal returns null.
    effect(() => {
      const e = this.entry();
      const ready = this.viewReady();
      if (!e || !ready) return;
      queueMicrotask(() => this.mountPreview());
    });
  }

  async ngOnInit(): Promise<void> {
    this.remote.set(this.route.snapshot.paramMap.get('remote') ?? '');
    this.expose.set(decodeURIComponent(this.route.snapshot.paramMap.get('expose') ?? ''));
    if (this.catalog.entries().length === 0) {
      await this.catalog.refresh();
    }
  }

  ngAfterViewInit(): void {
    this.viewReady.set(true);
  }

  ngOnDestroy(): void {
    this.teardown?.();
  }

  async remount(): Promise<void> {
    this.teardown?.();
    this.teardown = undefined;
    this.previewError.set(null);
    if (this.previewHost) this.previewHost.nativeElement.innerHTML = '';
    await this.mountPreview();
  }

  private async mountPreview(): Promise<void> {
    const e = this.entry();
    if (!e || !this.previewHost) return;
    try {
      // Plain dynamic import — framework-agnostic. Native-federation
      // loaders require the remote to be pre-registered with the
      // portal's federation config, which is impractical for arbitrary
      // catalog entries. We read the remote's manifest, look up the
      // chunk for the requested expose, and import it directly.
      const base = `/remotes/${this.toRoutePath(e.remote)}`;
      const manifestRes = await fetch(`${base}/remoteEntry.json`);
      if (!manifestRes.ok) throw new Error(`manifest HTTP ${manifestRes.status}`);
      const manifest = (await manifestRes.json()) as {
        exposes: Array<{ key: string; outFileName: string }>;
      };
      const expose = manifest.exposes.find((x) => x.key === e.expose);
      if (!expose) {
        this.previewError.set(`Remote does not expose "${e.expose}"`);
        return;
      }
      const moduleUrl = new URL(`${base}/${expose.outFileName}`, window.location.origin).href;
      const mod = (await import(/* @vite-ignore */ moduleUrl)) as Record<string, unknown>;
      const mount = mod['mount'] as ((el: HTMLElement) => void | (() => void)) | undefined;
      if (typeof mount === 'function') {
        const result = mount(this.previewHost.nativeElement);
        if (typeof result === 'function') this.teardown = result;
      } else if (mod['default']) {
        this.previewError.set('Remote only exposes a legacy default component; live preview requires mount(el).');
      } else {
        this.previewError.set('Remote does not expose a mount(el) function.');
      }
    } catch (err) {
      this.previewError.set(err instanceof Error ? err.message : String(err));
    }
  }

  /**
   * Map a remote name to its kebab-case route path. The catalog only
   * carries the camelCase name; the gateway routes by routePath. Lookup
   * via the registry would be more robust, but the convention is
   * "lowercase the camelCase and add a hyphen before each upper".
   */
  private toRoutePath(remoteName: string): string {
    return remoteName.replace(/([A-Z])/g, '-$1').replace(/^-/, '').toLowerCase();
  }

  inputEntries(e: CatalogEntry): Array<{ name: string; spec: CatalogEntry['inputs'][string] }> {
    return Object.entries(e.inputs).map(([name, spec]) => ({ name, spec }));
  }

  angularSnippet(e: CatalogEntry): string {
    return `// Template
<nexus-component
  remote="${e.remote}"
  expose="${e.expose}">
</nexus-component>

// Or via the runtime service
import { DynamicNexusService } from '@bimo-dk/nexus-runtime';

constructor(private nexus: DynamicNexusService) {}

const mod = await this.nexus.loadRemote('${e.remote}', '${e.expose}');
mod.mount(this.containerRef.nativeElement);`;
  }

  vueSnippet(e: CatalogEntry): string {
    return `<!-- Template -->
<NexusComponent remote="${e.remote}" expose="${e.expose}" />

<!-- Or imperative -->
<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { loadRemoteModule } from '@softarc/native-federation-runtime';

const host = ref<HTMLElement | null>(null);
onMounted(async () => {
  const mod = await loadRemoteModule({
    remoteEntry: '/remotes/${this.toRoutePath(e.remote)}/remoteEntry.json',
    exposedModule: '${e.expose}',
  });
  if (host.value) mod.mount(host.value);
});
</script>

<template><div ref="host" /></template>`;
  }

  reactSnippet(e: CatalogEntry): string {
    return `// Component
import { NexusComponent } from '@bimo-dk/nexus-runtime-react';

<NexusComponent remote="${e.remote}" expose="${e.expose}" />

// Or imperative
import { useEffect, useRef } from 'react';
import { loadRemoteModule } from '@softarc/native-federation-runtime';

const ref = useRef<HTMLDivElement>(null);
useEffect(() => {
  let teardown: (() => void) | null = null;
  (async () => {
    const mod = await loadRemoteModule({
      remoteEntry: '/remotes/${this.toRoutePath(e.remote)}/remoteEntry.json',
      exposedModule: '${e.expose}',
    });
    if (ref.current) teardown = mod.mount(ref.current);
  })();
  return () => teardown?.();
}, []);

<div ref={ref} />`;
  }

  vanillaSnippet(e: CatalogEntry): string {
    return `// Plain JS — works in any framework or none
import { loadRemoteModule } from '@softarc/native-federation-runtime';

const mod = await loadRemoteModule({
  remoteEntry: '/remotes/${this.toRoutePath(e.remote)}/remoteEntry.json',
  exposedModule: '${e.expose}',
});

const host = document.querySelector('#my-host');
const teardown = mod.mount(host);
// later, when you want to unmount:
// teardown();`;
  }

  async copy(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // clipboard API requires HTTPS — silent fallback
    }
  }
}
