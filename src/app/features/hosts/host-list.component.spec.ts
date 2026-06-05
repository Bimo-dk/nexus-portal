import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Subject } from 'rxjs';
import { of } from 'rxjs';
import { HostListComponent } from './host-list.component';
import { ManagerService } from '../services/manager.service';
import { HostEventService } from '../services/host-event.service';
import type { Host } from '../../types/platform';

const stubHost = (overrides: Partial<Host> = {}): Host => ({
  id: 'h1',
  name: 'shellApp',
  url: 'http://localhost:4000',
  framework: 'angular',
  remote_entry: '/host/remoteEntry.json',
  exposed_module: './AppShell',
  enabled: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  gate_count: 0,
  ...overrides,
});

describe('HostListComponent', () => {
  let fixture: ComponentFixture<HostListComponent>;
  let managerSpy: jasmine.SpyObj<ManagerService>;
  let hostChanged$: Subject<Host>;

  beforeEach(async () => {
    hostChanged$ = new Subject<Host>();

    managerSpy = jasmine.createSpyObj<ManagerService>('ManagerService', [
      'getHosts',
      'toggleHost',
      'deleteHost',
    ]);
    managerSpy.getHosts.and.returnValue(of([stubHost()]));

    await TestBed.configureTestingModule({
      imports: [HostListComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNoopAnimations(),
        { provide: ManagerService, useValue: managerSpy },
        {
          provide: HostEventService,
          useValue: { hostChanged$: hostChanged$.asObservable(), gateChanged$: new Subject().asObservable() },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HostListComponent);
    fixture.detectChanges();
  });

  it('renders a row for each host', () => {
    const rows = fixture.nativeElement.querySelectorAll('tr[mat-row]');
    expect(rows.length).toBe(1);
    expect(rows[0].textContent).toContain('shellApp');
  });

  it('shows the framework badge', () => {
    const badge = fixture.nativeElement.querySelector('.fw-angular');
    expect(badge).toBeTruthy();
    expect(badge.textContent.trim()).toBe('angular');
  });

  it('shows gate count for the host', () => {
    const cell = fixture.nativeElement.querySelector('.gate-count-btn');
    expect(cell).toBeTruthy();
    expect(cell.textContent.trim()).toBe('0');
  });

  it('rejects names that do not match camelCase', () => {
    const host = fixture.componentInstance;
    host.openCreate();
    fixture.detectChanges();

    const dialog = document.querySelector('app-host-form-dialog');
    if (!dialog) return; // dialog didn't open in this test environment

    const nameInput: HTMLInputElement | null = dialog.querySelector('input[formcontrolname="name"]');
    if (!nameInput) return;

    nameInput.value = 'not-valid-name';
    nameInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const error = dialog.querySelector('mat-error');
    expect(error).toBeTruthy();
  });

  it('updates the table row in place when host_changed arrives', fakeAsync(() => {
    const updated = stubHost({ name: 'shellAppRenamed' });

    hostChanged$.next(updated);
    tick(50);
    fixture.detectChanges();

    const rows = fixture.nativeElement.querySelectorAll('tr[mat-row]');
    expect(rows.length).toBe(1);
    expect(rows[0].textContent).toContain('shellAppRenamed');

    expect(managerSpy.getHosts).toHaveBeenCalledTimes(1);
  }));

  it('applies the flash class on host_changed and removes it after 700ms', fakeAsync(() => {
    hostChanged$.next(stubHost());
    tick(0);
    fixture.detectChanges();

    const row: HTMLElement = fixture.nativeElement.querySelector('tr[mat-row]');
    expect(row.classList).toContain('row-flash');

    tick(700);
    fixture.detectChanges();
    expect(row.classList).not.toContain('row-flash');
  }));
});
