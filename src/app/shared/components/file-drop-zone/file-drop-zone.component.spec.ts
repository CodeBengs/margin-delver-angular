import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FileDropZoneComponent } from './file-drop-zone.component';

function fileOfSize(bytes: number, name = 'f.xlsx'): File {
  // Build a File reporting the requested size without allocating it all.
  const file = new File([new Uint8Array(Math.min(bytes, 1024))], name);
  Object.defineProperty(file, 'size', { value: bytes });
  return file;
}

describe('FileDropZoneComponent', () => {
  let fixture: ComponentFixture<FileDropZoneComponent>;
  let component: FileDropZoneComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [FileDropZoneComponent] }).compileComponents();
    fixture = TestBed.createComponent(FileDropZoneComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('creates', () => {
    expect(component).toBeTruthy();
  });

  it('emits fileSelected for a file within the size limit', () => {
    const emitted = spyOn(component.fileSelected, 'emit');
    const sizeError = spyOn(component.fileSizeError, 'emit');

    const file = fileOfSize(1024); // 1KB, default limit 5MB
    component['handleFile'](file);

    expect(emitted).toHaveBeenCalledWith(file);
    expect(sizeError).not.toHaveBeenCalled();
    expect(component.sizeError()).toBe('');
  });

  it('emits fileSizeError and not fileSelected for an oversized file', () => {
    const emitted = spyOn(component.fileSelected, 'emit');
    const sizeError = spyOn(component.fileSizeError, 'emit');

    const file = fileOfSize(6 * 1024 * 1024); // 6MB > 5MB limit
    component['handleFile'](file);

    expect(emitted).not.toHaveBeenCalled();
    expect(sizeError).toHaveBeenCalled();
    expect(component.sizeError()).toContain('5MB');
  });

  it('tracks drag state via drag handlers', () => {
    const evt = new DragEvent('dragover');
    spyOn(evt, 'preventDefault');
    component.onDragOver(evt);
    expect(component.isDragging).toBeTrue();
    expect(evt.preventDefault).toHaveBeenCalled();

    component.onDragLeave();
    expect(component.isDragging).toBeFalse();
  });
});
