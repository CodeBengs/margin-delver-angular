import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';

export interface ParsedMenuRow {
  rowIndex: number;
  name: string;
  price: number | null;
  priceRaw: string;
  errors: ('empty_name' | 'empty_price' | 'invalid_price')[];
  isDuplicate?: boolean;
}

export interface ParsedMenuResult {
  rows: ParsedMenuRow[];
  headerDetected: boolean;
  totalRows: number;
}

export interface ParsedSalesColumn {
  header: string;
  matched: boolean;
  matchedName?: string;
}

export interface ParsedSalesRow {
  rowIndex: number;
  date: string;
  dateValid: boolean;
  quantities: Record<string, number>;  // blank cells = 0; invalid cells clamped to 0 and reported in cellErrors
  cellErrors: string[];  // e.g. 'invalid_qty:Nasi Goreng'
}

export interface ParsedSalesResult {
  columns: ParsedSalesColumn[];
  rows: ParsedSalesRow[];
  matchedCount: number;
  unmatchedCount: number;
  blockingErrors: string[];  // e.g. '>31 rows'
  warnings: string[];        // e.g. 'duplicate_date:2026-05-01'
}

@Injectable({ providedIn: 'root' })
export class ExcelParserService {
  parseMenuFile(file: File): Promise<ParsedMenuResult> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const buffer = e.target?.result as ArrayBuffer;
          const workbook = XLSX.read(buffer, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
            header: 1,
            raw: false,
            defval: ''
          });

          if (!rawRows.length) {
            resolve({ rows: [], headerDetected: false, totalRows: 0 });
            return;
          }

          // Detect header: first cell is a string with letters and not a pure number
          let startIndex = 0;
          let headerDetected = false;
          const firstCell = String(rawRows[0]?.[0] ?? '').trim();
          if (firstCell && isNaN(Number(firstCell)) && /[a-zA-Z]/.test(firstCell)) {
            headerDetected = true;
            startIndex = 1;
          }

          const dataRows = rawRows.slice(startIndex);
          const rows: ParsedMenuRow[] = [];

          for (let i = 0; i < dataRows.length; i++) {
            const row = dataRows[i] as unknown[];
            const nameRaw = String(row[0] ?? '').trim();
            const priceRaw = String(row[1] ?? '').trim();
            const errors: string[] = [];

            if (!nameRaw) errors.push('empty_name');

            let price: number | null = null;
            if (!priceRaw) {
              errors.push('empty_price');
            } else {
              price = this.parsePrice(priceRaw);
              if (price === null) errors.push('invalid_price');
            }

            rows.push({
              rowIndex: i + 1,
              name: nameRaw,
              price,
              priceRaw,
              errors
            });
          }

          // Mark duplicates
          const nameCounts = new Map<string, number>();
          for (const row of rows) {
            if (!row.name) continue;
            const key = row.name.toLowerCase();
            nameCounts.set(key, (nameCounts.get(key) ?? 0) + 1);
          }
          for (const row of rows) {
            if (row.name && (nameCounts.get(row.name.toLowerCase()) ?? 0) > 1) {
              row.isDuplicate = true;
            }
          }

          resolve({ rows, headerDetected, totalRows: rows.length });
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    });
  }

  parseSalesFile(file: File, knownMenuNames: string[]): Promise<ParsedSalesResult> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const buffer = e.target?.result as ArrayBuffer;
          const workbook = XLSX.read(buffer, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
            header: 1,
            raw: false,
            defval: ''
          });

          const warnings: string[] = [];
          const blockingErrors: string[] = [];

          if (!rawRows.length) {
            resolve({
              columns: [],
              rows: [],
              matchedCount: 0,
              unmatchedCount: 0,
              warnings,
              blockingErrors
            });
            return;
          }

          // Row 0 is headers
          const headerRow = rawRows[0] as unknown[];
          const columns: ParsedSalesColumn[] = [];

          for (let c = 1; c < headerRow.length; c++) {
            const header = String(headerRow[c] ?? '').trim();
            if (!header) continue;

            const matchedName = knownMenuNames.find(
              (n) => n.trim().toLowerCase() === header.toLowerCase()
            );
            columns.push({
              header,
              matched: !!matchedName,
              matchedName
            });
          }

          const matchedCount = columns.filter((c) => c.matched).length;
          const unmatchedCount = columns.filter((c) => !c.matched).length;

          // Data rows start from index 1
          const dataRows = rawRows.slice(1);

          if (dataRows.length > 31) {
            blockingErrors.push(`Too many rows: ${dataRows.length} (maximum is 31)`);
          }

          const rows: ParsedSalesRow[] = [];
          const seenDates = new Map<string, number>();

          for (let i = 0; i < dataRows.length; i++) {
            const row = dataRows[i] as unknown[];
            const dateRaw = String(row[0] ?? '').trim();
            const rowErrors: string[] = [];

            const { dateStr, dateValid } = this.parseDate(dateRaw);
            if (!dateValid) rowErrors.push('invalid_date');

            // Track duplicate dates
            if (dateValid && dateStr) {
              const prev = seenDates.get(dateStr);
              if (prev !== undefined) {
                if (!warnings.some((w) => w.includes(dateStr))) {
                  warnings.push(`Duplicate date: ${dateStr}`);
                }
              }
              seenDates.set(dateStr, i);
            }

            const quantities: Record<string, number> = {};
            for (let c = 0; c < columns.length; c++) {
              const col = columns[c];
              const cellRaw = String(row[c + 1] ?? '').trim();

              if (!cellRaw) {
                quantities[col.header] = 0;
              } else {
                const qty = parseInt(cellRaw, 10);
                if (isNaN(qty) || qty < 0) {
                  quantities[col.header] = 0;
                  rowErrors.push(`invalid_qty:${col.header}`);
                } else {
                  quantities[col.header] = qty;
                }
              }
            }

            rows.push({
              rowIndex: i + 1,
              date: dateRaw,
              dateValid,
              quantities,
              cellErrors: rowErrors
            });
          }

          resolve({
            columns,
            rows,
            matchedCount,
            unmatchedCount,
            blockingErrors,
            warnings
          });
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    });
  }

  private parsePrice(raw: string): number | null {
    // Strip IDR formatting: "Rp", ".", " " and replace "," with "."
    const cleaned = raw
      .replace(/Rp\.?\s*/gi, '')
      .replace(/\./g, '')
      .replace(/,/g, '.')
      .replace(/\s/g, '')
      .trim();

    const num = parseFloat(cleaned);
    if (isNaN(num) || !isFinite(num)) return null;
    return num;
  }

  private parseDate(raw: string): { dateStr: string; dateValid: boolean } {
    if (!raw) return { dateStr: '', dateValid: false };

    // Accept DD/MM/YYYY
    const ddmmyyyy = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (ddmmyyyy) {
      const [, d, m, y] = ddmmyyyy;
      const date = new Date(Number(y), Number(m) - 1, Number(d));
      if (
        date.getFullYear() === Number(y) &&
        date.getMonth() === Number(m) - 1 &&
        date.getDate() === Number(d)
      ) {
        return { dateStr: `${y}-${m}-${d}`, dateValid: true };
      }
    }

    // Accept YYYY-MM-DD
    const yyyymmdd = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (yyyymmdd) {
      const [, y, m, d] = yyyymmdd;
      const date = new Date(Number(y), Number(m) - 1, Number(d));
      if (
        date.getFullYear() === Number(y) &&
        date.getMonth() === Number(m) - 1 &&
        date.getDate() === Number(d)
      ) {
        return { dateStr: `${y}-${m}-${d}`, dateValid: true };
      }
    }

    return { dateStr: raw, dateValid: false };
  }
}
