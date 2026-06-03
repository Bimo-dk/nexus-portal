import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export type CatalogInputType = 'string' | 'number' | 'boolean' | 'object' | 'array';

export interface CatalogInputSpec {
  type: CatalogInputType;
  default?: unknown;
  description?: string;
  required?: boolean;
  enum?: string[];
}

export interface CatalogEntry {
  remote: string;
  expose: string;
  className: string;
  title: string;
  description?: string;
  category?: string;
  tags: string[];
  icon?: string;
  inputs: Record<string, CatalogInputSpec>;
  experimental: boolean;
}

interface CatalogManifest {
  remote: string;
  generatedAt: string;
  entries: CatalogEntry[];
}

interface RegistryRemote {
  name: string;
  url: string;
  enabled: boolean;
}

/**
 * Portal-side catalog aggregator. Reads /catalog.json from every remote
 * registered with the registry (via /api/remotes) and merges entries into
 * one searchable signal. Mirrors @bimo-dk/nexus-runtime's CatalogService
 * but lives standalone because the portal doesn't run a federated host.
 */
@Injectable({ providedIn: 'root' })
export class CatalogService {
  private readonly http = inject(HttpClient);

  readonly entries = signal<CatalogEntry[]>([]);
  readonly loading = signal<boolean>(false);
  readonly errors = signal<Map<string, string>>(new Map());
  readonly lastRefresh = signal<Date | null>(null);

  readonly categories = computed<string[]>(() => {
    const set = new Set<string>();
    for (const e of this.entries()) if (e.category) set.add(e.category);
    return Array.from(set).sort();
  });

  readonly tags = computed<string[]>(() => {
    const set = new Set<string>();
    for (const e of this.entries()) for (const t of e.tags) set.add(t);
    return Array.from(set).sort();
  });

  readonly remotes = computed<string[]>(() => {
    const set = new Set<string>();
    for (const e of this.entries()) set.add(e.remote);
    return Array.from(set).sort();
  });

  async refresh(): Promise<void> {
    this.loading.set(true);
    const errors = new Map<string, string>();
    const collected: CatalogEntry[] = [];

    try {
      const res = await firstValueFrom(
        this.http.get<{ remotes: RegistryRemote[] }>(`${environment.registryUrl}/remotes`),
      );
      const enabled = res.remotes.filter((r) => r.enabled);

      await Promise.all(enabled.map(async (r) => {
        const catalogUrl = r.url.replace(/\/remoteEntry\.json([?#].*)?$/, '/catalog.json');
        try {
          const m = await firstValueFrom(
            this.http.get<CatalogManifest>(catalogUrl, { headers: { Accept: 'application/json' } }),
          );
          if (m?.entries?.length) {
            for (const e of m.entries) collected.push({ ...e, remote: r.name });
          } else {
            errors.set(r.name, 'no entries');
          }
        } catch (err: unknown) {
          errors.set(r.name, err instanceof Error ? err.message : String(err));
        }
      }));
    } catch (err: unknown) {
      errors.set('registry', err instanceof Error ? err.message : String(err));
    }

    this.entries.set(collected);
    this.errors.set(errors);
    this.lastRefresh.set(new Date());
    this.loading.set(false);
  }

  filter(opts: { query?: string; category?: string; tag?: string; remote?: string }): CatalogEntry[] {
    const q = opts.query?.toLowerCase().trim();
    return this.entries().filter((e) => {
      if (opts.remote && e.remote !== opts.remote) return false;
      if (opts.category && e.category !== opts.category) return false;
      if (opts.tag && !e.tags.includes(opts.tag)) return false;
      if (q) {
        const hay = `${e.title} ${e.description ?? ''} ${e.tags.join(' ')} ${e.expose}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }
}
