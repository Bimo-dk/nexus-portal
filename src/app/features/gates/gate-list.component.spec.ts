import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Subject, of } from 'rxjs';
import { GateListComponent } from './gate-list.component';
import { ManagerService } from '../services/manager.service';
import { HostEventService } from '../services/host-event.service';
import type { Gate, Host, GateChangedEvent } from '../../types/platform';

const stubHost = (): Host => ({
  id: 'h1',
  name: 'shellApp',
  url: 'http://localhost:4000',
  framework: 'angular',
  remote_entry: '/host/remoteEntry.json',
  exposed_module: './AppShell',
  enabled: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  gate_count: 1,
});

const stubGate = (overrides: Partial<Gate> = {}): Gate => ({
  id: 'g1',
  name: 'mainGate',
  domain: 'app.example.com',
  host_id: 'h1',
  host: stubHost(),
  enabled: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...overrides,
});

describe('GateListComponent', () => {
  let fixture: ComponentFixture<GateListComponent>;
  let managerSpy: jasmine.SpyObj<ManagerService>;
  let gateChanged$: Subject<GateChangedEvent>;

  beforeEach(async () => {
    gateChanged$ = new Subject<GateChangedEvent>();

    managerSpy = jasmine.createSpyObj<ManagerService>('ManagerService', [
      'getGates',
      'getHosts',
      'toggleGate',
      'deleteGate',
    ]);
    managerSpy.getGates.and.returnValue(of([stubGate()]));
    managerSpy.getHosts.and.returnValue(of([stubHost()]));

    await TestBed.configureTestingModule({
      imports: [GateListComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNoopAnimations(),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: { get: () => null } } },
        },
        { provide: ManagerService, useValue: managerSpy },
        {
          provide: HostEventService,
          useValue: {
            hostChanged$: new Subject().asObservable(),
            gateChanged$: gateChanged$.asObservable(),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(GateListComponent);
    fixture.detectChanges();
  });

  it('renders a row for each gate', () => {
    const rows = fixture.nativeElement.querySelectorAll('tr[mat-row]');
    expect(rows.length).toBe(1);
    expect(rows[0].textContent).toContain('mainGate');
  });

  it('shows the domain as a link', () => {
    const link = fixture.nativeElement.querySelector('a.domain-link');
    expect(link).toBeTruthy();
    expect(link.textContent.trim()).toBe('app.example.com');
  });

  it('shows the host name and framework badge in the host column', () => {
    const badge = fixture.nativeElement.querySelector('.fw-angular');
    expect(badge).toBeTruthy();
    const hostCell = badge.closest('td');
    expect(hostCell.textContent).toContain('shellApp');
  });

  it('shows a warning toast and flashes the host column when gate_changed trigger is host_reassigned', fakeAsync(() => {
    const snackOpenSpy = spyOn(
      (fixture.componentInstance as any).snack,
      'open',
    );

    gateChanged$.next({
      gate: stubGate({ name: 'mainGate' }),
      trigger: 'host_reassigned',
      old_host_id: 'h1',
      new_host_id: 'h2',
    });
    tick(0);
    fixture.detectChanges();

    expect(snackOpenSpy).toHaveBeenCalledWith(
      jasmine.stringContaining('reassigned'),
      jasmine.anything(),
      jasmine.objectContaining({ panelClass: jasmine.arrayContaining(['warn-snack']) }),
    );
  }));

  it('updates the gate row without a full reload when gate_changed arrives', fakeAsync(() => {
    gateChanged$.next({
      gate: stubGate({ name: 'renamedGate' }),
      trigger: 'updated',
    });
    tick(0);
    fixture.detectChanges();

    const rows = fixture.nativeElement.querySelectorAll('tr[mat-row]');
    expect(rows.length).toBe(1);
    expect(rows[0].textContent).toContain('renamedGate');
    expect(managerSpy.getGates).toHaveBeenCalledTimes(1);
  }));
});
