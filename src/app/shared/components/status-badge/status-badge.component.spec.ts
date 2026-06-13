import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StatusBadgeComponent } from './status-badge.component';

describe('StatusBadgeComponent', () => {
  let fixture: ComponentFixture<StatusBadgeComponent>;
  let component: StatusBadgeComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [StatusBadgeComponent] }).compileComponents();
    fixture = TestBed.createComponent(StatusBadgeComponent);
    component = fixture.componentInstance;
  });

  it('creates with a neutral default tone', () => {
    expect(component).toBeTruthy();
    expect(component.tone).toBe('neutral');
  });

  it('renders the label and applies the tone class', () => {
    component.label = 'Ready';
    component.tone = 'success';
    fixture.detectChanges();

    const badge: HTMLElement = fixture.nativeElement.querySelector('.badge');
    expect(badge.textContent?.trim()).toBe('Ready');
    expect(badge.classList).toContain('success');
  });
});
