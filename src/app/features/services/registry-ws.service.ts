import { Injectable, OnDestroy, effect, inject, signal } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { AuthService } from '../auth/auth.service';

type AnyMessage = Record<string, unknown>;

export interface LogMessage {
  type: 'log';
  entry?: { message: string; level?: string; source?: string; [key: string]: unknown };
}

export type WsConnectionState = 'connected' | 'connecting' | 'disconnected';

const AUTH_CLOSE_CODES = new Set([4401, 4403]);

@Injectable({ providedIn: 'root' })
export class RegistryWsService implements OnDestroy {
  private readonly auth = inject(AuthService);
  private socket: WebSocket | null = null;
  private readonly messages = new Subject<AnyMessage>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;
  private delay = 1_000;

  readonly connectionState = signal<WsConnectionState>('disconnected');

  constructor() {
    effect(() => {
      const user = this.auth.user();
      if (user) this.connect();
      else this.disconnect();
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
    this.disconnect();
    this.messages.complete();
  }

  private disconnect(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.socket?.close();
    this.socket = null;
    this.connectionState.set('disconnected');
  }

  private connect(): void {
    if (this.socket && this.socket.readyState !== WebSocket.CLOSED) return;
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

    this.socket.addEventListener('close', (ev: CloseEvent) => {
      this.connectionState.set('disconnected');
      if (this.destroyed) return;
      if (AUTH_CLOSE_CODES.has(ev.code)) return;
      if (!this.auth.user()) return;
      this.scheduleReconnect();
    });

    this.socket.addEventListener('error', () => {
      this.socket?.close();
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer !== null) return;
    this.connectionState.set('connecting');
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.delay = Math.min(this.delay * 2, 30_000);
      this.connect();
    }, this.delay);
  }

  private wsUrl(): string {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}/api/ws`;
  }
}
