import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import { RemoteAddComponent } from './remote-add.component';
import { ManagerService } from '../services/manager.service';
import type { Host } from '../../types/platform';

const stubHost = (): Host => ({
  id: 'h1',
  name: 'shellApp',
  url: 'http://localhost:4000',
  framework: 'angular',
  remoteEntry: '/host/remoteEntry.json',
  exposedModule: './AppShell',
  enabled: true,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  gateCount: 0,
});

describe('remote visibility field', () => {
  let fixture: ComponentFixture<RemoteAddComponent>;
  let managerSpy: jasmine.SpyObj<ManagerService>;
  let submitPayload: unknown;

  beforeEach(async () => {
    managerSpy = jasmine.createSpyObj<ManagerService>('ManagerService', ['getHosts', 'addRemote']);
    managerSpy.getHosts.and.returnValue(of([stubHost()]));
    managerSpy.addRemote.and.callFake((dto) => {
      submitPayload = dto;
      return of({ name: 'testRemote', url: dto.url, exposedModule: './RemoteEntry', routePath: 'test', enabled: true, addedAt: '' } as any);
    });

    await TestBed.configureTestingModule({
      imports: [RemoteAddComponent],
      providers: [
        provideRouter([{ path: 'remotes', children: [] }]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNoopAnimations(),
        { provide: ManagerService, useValue: managerSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RemoteAddComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('shows global radio selected by default', () => {
    const form = fixture.componentInstance.form;
    expect(form.getRawValue().visibilityType).toBe('global');
  });

  it('does not show the host select when global is selected', () => {
    const hostSelect = fixture.nativeElement.querySelector('mat-select[formcontrolname="visibilityHostId"]');
    expect(hostSelect).toBeNull();
  });

  it('reveals the host select when host-specific is chosen', async () => {
    fixture.componentInstance.form.controls.visibilityType.setValue('host');
    fixture.detectChanges();
    await fixture.whenStable();

    const hostSelect = fixture.nativeElement.querySelector('mat-select[formcontrolname="visibilityHostId"]');
    expect(hostSelect).toBeTruthy();
  });

  it('builds visibility as host:{id} when host-specific and a host is selected', async () => {
    const form = fixture.componentInstance.form;
    form.controls.name.setValue('testRemote');
    form.controls.url.setValue('http://localhost:4200/remoteEntry.json');
    form.controls.routePath.setValue('test-remote');
    form.controls.visibilityType.setValue('host');
    form.controls.visibilityHostId.setValue('h1');
    fixture.detectChanges();

    fixture.componentInstance.onSubmit();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(managerSpy.addRemote).toHaveBeenCalled();
    const dto = submitPayload as Record<string, unknown>;
    expect(dto['visibility']).toBe('host:h1');
  });

  it('builds visibility as global when global is selected', async () => {
    const form = fixture.componentInstance.form;
    form.controls.name.setValue('testRemote');
    form.controls.url.setValue('http://localhost:4200/remoteEntry.json');
    form.controls.routePath.setValue('test-remote');
    form.controls.visibilityType.setValue('global');
    fixture.detectChanges();

    fixture.componentInstance.onSubmit();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(managerSpy.addRemote).toHaveBeenCalled();
    const dto = submitPayload as Record<string, unknown>;
    expect(dto['visibility']).toBe('global');
  });
});
