import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ImportBlockedComponent } from './import-blocked.component';

describe('ImportBlockedComponent', () => {
  let fixture: ComponentFixture<ImportBlockedComponent>;
  let component: ImportBlockedComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ImportBlockedComponent] }).compileComponents();
    fixture = TestBed.createComponent(ImportBlockedComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('creates', () => {
    expect(component).toBeTruthy();
  });

  it('emits cancel and reupload', () => {
    const cancel = spyOn(component.cancel, 'emit');
    const reupload = spyOn(component.reupload, 'emit');

    component.cancel.emit();
    component.reupload.emit();

    expect(cancel).toHaveBeenCalled();
    expect(reupload).toHaveBeenCalled();
  });
});
