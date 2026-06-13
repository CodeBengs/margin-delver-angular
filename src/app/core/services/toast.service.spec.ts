import { fakeAsync, TestBed, tick } from '@angular/core/testing';

import { ToastService } from './toast.service';

describe('ToastService', () => {
  let service: ToastService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ToastService);
  });

  it('adds a toast and returns its id', () => {
    const id = service.show('Saved', { duration: 0 });
    const toasts = service.toasts();
    expect(toasts.length).toBe(1);
    expect(toasts[0].id).toBe(id);
    expect(toasts[0].message).toBe('Saved');
    expect(toasts[0].type).toBe('info'); // default
  });

  it('honours an explicit type and action', () => {
    service.show('Go', { type: 'success', action: { label: 'View', route: '/x' }, duration: 0 });
    expect(service.toasts()[0].type).toBe('success');
    expect(service.toasts()[0].action).toEqual({ label: 'View', route: '/x' });
  });

  it('dismiss removes the matching toast only', () => {
    const a = service.show('A', { duration: 0 });
    service.show('B', { duration: 0 });
    service.dismiss(a);
    const remaining = service.toasts();
    expect(remaining.length).toBe(1);
    expect(remaining[0].message).toBe('B');
  });

  it('auto-dismisses after the given duration', fakeAsync(() => {
    service.show('Bye', { duration: 1000 });
    expect(service.toasts().length).toBe(1);
    tick(1000);
    expect(service.toasts().length).toBe(0);
  }));

  it('does not auto-dismiss when duration is 0', fakeAsync(() => {
    service.show('Sticky', { duration: 0 });
    tick(60000);
    expect(service.toasts().length).toBe(1);
  }));
});
