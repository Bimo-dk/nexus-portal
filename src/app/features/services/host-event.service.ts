import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { RegistryWsService } from './registry-ws.service';
import type { Host, GateChangedEvent, HostChangedMessage, GateChangedMessage } from '../../types/platform';

@Injectable({ providedIn: 'root' })
export class HostEventService {
  private readonly ws = inject(RegistryWsService);

  readonly hostChanged$: Observable<Host> = this.ws
    .messagesOfType<HostChangedMessage>('host_changed')
    .pipe(map((m) => m.host));

  readonly gateChanged$: Observable<GateChangedEvent> = this.ws
    .messagesOfType<GateChangedMessage>('gate_changed')
    .pipe(
      map((m) => ({
        gate: m.gate,
        trigger: m.trigger,
        old_host_id: m.old_host_id,
        new_host_id: m.new_host_id,
      })),
    );
}
