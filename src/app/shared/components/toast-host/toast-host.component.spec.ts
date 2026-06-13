import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ToastService } from '../../../core/services/toast.service';
import { ToastHostComponent } from './toast-host.component';

describe('ToastHostComponent', () => {
  let fixture: ComponentFixture<ToastHostComponent>;
  let component: ToastHostComponent;
  let toastService: ToastService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ToastHostComponent],
      providers: [provideRouter([])]
    }).compileComponents();
    fixture = TestBed.createComponent(ToastHostComponent);
    component = fixture.componentInstance;
    toastService = TestBed.inject(ToastService);
  });

  it('creates', () => {
    expect(component).toBeTruthy();
  });

  it('renders toasts from the service', () => {
    toastService.show('Hello', { duration: 0 });
    fixture.detectChanges();
    const message: HTMLElement = fixture.nativeElement.querySelector('.toast-message');
    expect(message.textContent?.trim()).toBe('Hello');
  });

  it('delegates dismiss to the service', () => {
    const spy = spyOn(toastService, 'dismiss');
    component.dismiss(7);
    expect(spy).toHaveBeenCalledWith(7);
  });
});
