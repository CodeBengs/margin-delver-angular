import { TestBed } from '@angular/core/testing';
import * as XLSX from 'xlsx';

import { ExcelParserService } from './excel-parser.service';

/** Build a real .xlsx File in memory from a 2D array of cell values. */
function makeXlsxFile(rows: unknown[][], name = 'test.xlsx'): File {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return new File([buf], name, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
}

describe('ExcelParserService', () => {
  let service: ExcelParserService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ExcelParserService);
  });

  it('is created', () => {
    expect(service).toBeTruthy();
  });

  describe('parseMenuFile', () => {
    it('detects a header row and parses valid rows', async () => {
      const file = makeXlsxFile([
        ['Name', 'Price'],
        ['Nasi Goreng', '25000'],
        ['Es Teh', 'Rp 8.000']
      ]);
      const result = await service.parseMenuFile(file);

      expect(result.headerDetected).toBeTrue();
      expect(result.totalRows).toBe(2);
      expect(result.errors.length).toBe(0);
      expect(result.rows[0]).toEqual(jasmine.objectContaining({ name: 'Nasi Goreng', price: 25000 }));
      // IDR formatting stripped: "Rp 8.000" -> 8000
      expect(result.rows[1].price).toBe(8000);
    });

    it('flags missing name and missing/invalid price', async () => {
      const file = makeXlsxFile([
        ['Name', 'Price'],
        ['', '5000'],          // missing name
        ['Kopi', ''],          // missing price
        ['Teh', 'abc']         // invalid price
      ]);
      const result = await service.parseMenuFile(file);

      const cats = result.errors.map((e) => e.category);
      expect(cats).toContain('missing_name');
      expect(cats).toContain('missing_price');
      expect(cats).toContain('invalid_price');
    });

    it('detects in-file duplicates and clashes with existing names', async () => {
      const file = makeXlsxFile([
        ['Name', 'Price'],
        ['Kopi', '10000'],
        ['kopi', '11000'],     // dup of row above (case-insensitive)
        ['Teh', '8000']        // clashes with existing menu
      ]);
      const result = await service.parseMenuFile(file, ['Teh']);

      const dupErrors = result.errors.filter((e) => e.category === 'duplicate_item');
      expect(dupErrors.length).toBe(2);
    });

    it('returns an empty result for an empty sheet', async () => {
      const file = makeXlsxFile([]);
      const result = await service.parseMenuFile(file);
      expect(result.totalRows).toBe(0);
      expect(result.headerDetected).toBeFalse();
    });
  });

  describe('parseSalesFile', () => {
    it('matches columns to known menu names and aggregates valid units', async () => {
      const file = makeXlsxFile([
        ['Date', 'Nasi Goreng', 'Unknown Item'],
        ['01/06/2026', 5, 2],
        ['02/06/2026', 3, 1]
      ]);
      const result = await service.parseSalesFile(file, ['Nasi Goreng']);

      expect(result.matchedCount).toBe(1);
      expect(result.unmatchedCount).toBe(1);
      expect(result.rows.length).toBe(2);
      expect(result.rows[0].quantities['Nasi Goreng']).toBe(5);
      expect(result.errors.some((e) => e.category === 'column_not_in_menu')).toBeTrue();
    });

    it('flags negative, empty, and non-numeric unit cells', async () => {
      const file = makeXlsxFile([
        ['Date', 'Kopi'],
        ['01/06/2026', -1],
        ['02/06/2026', ''],
        ['03/06/2026', 'x']
      ]);
      const result = await service.parseSalesFile(file, ['Kopi']);

      const unitErrors = result.errors.filter((e) => e.category === 'invalid_unit_count');
      expect(unitErrors.length).toBe(3);
      // invalid cells default the quantity to 0
      expect(result.rows.every((r) => r.quantities['Kopi'] === 0)).toBeTrue();
    });

    it('flags duplicate dates', async () => {
      const file = makeXlsxFile([
        ['Date', 'Kopi'],
        ['01/06/2026', 1],
        ['01/06/2026', 2]
      ]);
      const result = await service.parseSalesFile(file, ['Kopi']);
      expect(result.errors.some((e) => e.category === 'duplicate_date')).toBeTrue();
    });

    it('flags a file with more than 31 day rows', async () => {
      const rows: unknown[][] = [['Date', 'Kopi']];
      for (let d = 1; d <= 32; d++) {
        rows.push([`${String(d).padStart(2, '0')}/01/2026`, 1]);
      }
      const result = await service.parseSalesFile(makeXlsxFile(rows), ['Kopi']);
      expect(result.errors.some((e) => e.category === 'too_many_rows')).toBeTrue();
    });
  });
});
