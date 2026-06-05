import { Injectable, OnDestroy, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { toObservable } from '@angular/core/rxjs-interop';
import { Observable, Subject } from 'rxjs';
import { distinctUntilChanged, filter, map, skip } from 'rxjs/operators';
import { SettingsService } from './settings.service';

type AnyMessage = Record<string, unknown>;

export interface LogMessage {
  type: 'log';
  entry?: { message: string; level?: string; source?: string; [key: string]: unknown };
}

export type WsConnectionState = 'connected' | 'connecting' | 'disconnected';

@Injectable({ providedIn: 'root' })
export class RegistryWsService implements OnDestroy {
  private readonly settings = inject(SettingsService);
  private socket: WebSocket | null = null;
  private readonly messages = new Subject<AnyMessage>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;
  private delay = 1_000;

  readonly connectionState = signal<WsConnectionState>('connecting');

  constructor() {
    this.connect();

    toObservable(this.settings.registryUrl)
      .pipe(skip(1), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(() => {
        this.delay = 1_000;
        this.connectionState.set('connecting');
        this.socket?.close();
      });
  }

  messagesOfType<T>(type: string): Observable<T> {
    return this.messages.pipe(
      filter((m) => m['type'] === type),
      map((m) => m as unknown as T),
    );
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    if (this.reconnectTimer !== null) clearTimeout(this.reconnectTimer);
    this.socket?.close();
    this.messages.complete();
  }

  private connect(): void {
    this.connectionState.set('connecting');
    try {
      this.socket = new WebSocket(this.wsUrl());
    } catch {
      this.connectionState.set('disconnected');
      this.scheduleReconnect();
      return;
    }

    this.socket.addEventListener('open', () => {
      this.delay = 1_000;
      this.connectionState.set('connected');
      if (this.socket?.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({ type: 'subscribe_gate', gate_name: 'portal' }));
        this.socket.send(JSON.stringify({ type: 'subscribe', subscribe: 'logs' }));
      }
    });

    this.socket.addEventListener('message', (ev: MessageEvent<unknown>) => {
      try {
        this.messages.next(JSON.parse(ev.data as string) as AnyMessage);
      } catch { /* ignore malformed frames */ }
    });

    this.socket.addEventListener('close', () => {
      this.connectionState.set('disconnected');
      if (!this.destroyed) this.scheduleReconnect();
    });

    this.socket.addEventListener('error', () => {
      this.socket?.close();
    });
  }

  private scheduleReconnect(): void {
    this.connectionState.set('connecting');
    this.reconnectTimer = setTimeout(() => {
      this.delay = Math.min(this.delay * 2, 30_000);
      this.connect();
    }, this.delay);
  }

  private wsUrl(): string {
    const registryUrl = this.settings.registryUrl();
    const token = encodeURIComponent(this.settings.nexusToken());

    if (registryUrl.startsWith('http://') || registryUrl.startsWith('https://')) {
      const u = new URL(registryUrl);
      const proto = u.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsPath = u.pathname.replace(/\/+$/, '') + '/ws';
      return `${proto}//${u.host}${wsPath}?token=${token}`;
    }

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const path = registryUrl.replace(/\/+$/, '') + '/ws';
    return `${proto}//${window.location.host}${path}?token=${token}`;
  }
}
