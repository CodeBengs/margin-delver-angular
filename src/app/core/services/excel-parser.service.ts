import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';

/* ===== MENU MODEL ===== */
export type MenuErrorCategory = 'missing_name' | 'missing_price' | 'invalid_price' | 'duplicate_item';

export interface MenuError {
  rowIndex: number;            // 1-based data row (after header)
  field: 'name' | 'price';
  category: MenuErrorCategory;
  message: string;
}

export interface ParsedMenuRow {
  rowIndex: number;
  name: string;
  price: number | null;
  priceRaw: string;
  nameError?: string;          // message for the name cell, if any
  priceError?: string;         // message for the price cell, if any
}

export interface ParsedMenuResult {
  rows: ParsedMenuRow[];
  headerDetected: boolean;
  totalRows: number;
  errors: MenuError[];         // flat categorized list
  fileName: string;
}

/* ===== SALES MODEL ===== */
export type SalesErrorCategory = 'column_not_in_menu' | 'duplicate_date' | 'invalid_unit_count' | 'outside_period';

export interface SalesError {
  category: SalesErrorCategory;
  rowIndex?: number;           // 1-based data row, for date/unit errors
  column?: string;             // header, for unit/column errors
  field: 'column' | 'date' | 'unit';
  message: string;
}

export interface ParsedSalesColumn {
  header: string;
  columnIndex: number;
  matched: boolean;
  matchedName?: string;
  error?: string;              // for unmatched columns
}

export interface ParsedSalesRow {
  rowIndex: number;
  date: string;
  dateValid: boolean;
  dateError?: string;                       // message for the date cell, if any
  quantities: Record<string, number>;       // matched columns only; blanks/invalid stored as 0
  rawCells: Record<string, string>;          // header -> trimmed raw cell string, ALL columns ('' for empty)
  cellErrors: Record<string, string>;        // header -> message, for matched-column unit cells
}

export interface ParsedSalesResult {
  columns: ParsedSalesColumn[];
  rows: ParsedSalesRow[];
  matchedCount: number;
  unmatchedCount: number;
  errors: SalesError[];        // flat categorized list
  fileName: string;
}

@Injectable({ providedIn: 'root' })
export class ExcelParserService {
  parseMenuFile(file: File, existingNames: string[] = []): Promise<ParsedMenuResult> {
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
            resolve({ rows: [], headerDetected: false, totalRows: 0, errors: [], fileName: file.name });
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
          const errors: MenuError[] = [];

          const existingSet = new Set(existingNames.map((n) => n.trim().toLowerCase()));
          // First occurrence of each name in the file: key -> { rowIndex, name }
          const firstSeen = new Map<string, { rowIndex: number; name: string }>();

          for (let i = 0; i < dataRows.length; i++) {
            const row = dataRows[i] as unknown[];
            const nameRaw = String(row[0] ?? '').trim();
            const priceRaw = String(row[1] ?? '').trim();
            const rowIndex = i + 1;

            const parsedRow: ParsedMenuRow = {
              rowIndex,
              name: nameRaw,
              price: null,
              priceRaw
            };

            // Name validation
            if (!nameRaw) {
              parsedRow.nameError = 'Menu name is required';
              errors.push({ rowIndex, field: 'name', category: 'missing_name', message: parsedRow.nameError });
            }

            // Price validation
            if (!priceRaw) {
              parsedRow.priceError = 'Selling price is required';
              errors.push({ rowIndex, field: 'price', category: 'missing_price', message: parsedRow.priceError });
            } else {
              const price = this.parsePrice(priceRaw);
              if (price === null) {
                parsedRow.priceError = 'Not a number';
                errors.push({ rowIndex, field: 'price', category: 'invalid_price', message: parsedRow.priceError });
              } else {
                parsedRow.price = price;
              }
            }

            // Duplicate detection (skip rows already missing a name)
            if (nameRaw) {
              const key = nameRaw.toLowerCase();
              const earlier = firstSeen.get(key);
              if (earlier) {
                parsedRow.nameError = `Duplicate of row ${earlier.rowIndex} — '${earlier.name}'`;
                errors.push({ rowIndex, field: 'name', category: 'duplicate_item', message: parsedRow.nameError });
              } else if (existingSet.has(key)) {
                parsedRow.nameError = `'${nameRaw}' is already in your menu`;
                errors.push({ rowIndex, field: 'name', category: 'duplicate_item', message: parsedRow.nameError });
              } else {
                firstSeen.set(key, { rowIndex, name: nameRaw });
              }
            }

            rows.push(parsedRow);
          }

          resolve({ rows, headerDetected, totalRows: rows.length, errors, fileName: file.name });
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

          const errors: SalesError[] = [];

          if (!rawRows.length) {
            resolve({
              columns: [],
              rows: [],
              matchedCount: 0,
              unmatchedCount: 0,
              errors,
              fileName: file.name
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
            const column: ParsedSalesColumn = {
              header,
              columnIndex: c,
              matched: !!matchedName,
              matchedName
            };
            if (!matchedName) {
              column.error = `'${header}' is not in your menu — add it first or remove the column`;
              errors.push({ category: 'column_not_in_menu', field: 'column', column: header, message: column.error });
            }
            columns.push(column);
          }

          const matchedCount = columns.filter((c) => c.matched).length;
          const unmatchedCount = columns.filter((c) => !c.matched).length;

          // PERIOD = previous calendar month relative to NOW
          const now = new Date();
          let pMonth = now.getMonth() - 1;
          let pYear = now.getFullYear();
          if (pMonth < 0) { pMonth = 11; pYear -= 1; }

          // Data rows start from index 1
          const dataRows = rawRows.slice(1);
          const rows: ParsedSalesRow[] = [];
          const seenDates = new Map<string, number>();   // normalized date -> display row index of first occurrence

          for (let i = 0; i < dataRows.length; i++) {
            const row = dataRows[i] as unknown[];
            const dateRaw = String(row[0] ?? '').trim();
            const rowIndex = i + 1;

            const { dateStr, dateValid, date } = this.parseDate(dateRaw);

            const parsedRow: ParsedSalesRow = {
              rowIndex,
              date: dateRaw,
              dateValid,
              quantities: {},
              rawCells: {},
              cellErrors: {}
            };

            // Capture trimmed raw cell strings for ALL columns (matched + unmatched).
            for (const col of columns) {
              parsedRow.rawCells[col.header] = String(row[col.columnIndex] ?? '').trim();
            }

            // Date checks — pick ONE date error per row (prefer duplicate_date over outside_period)
            let dateError: string | undefined;
            let dateCategory: SalesErrorCategory | undefined;

            if (!dateValid || !date) {
              dateError = 'Not a valid date';
              dateCategory = 'outside_period';
            } else {
              // Check duplicate first
              const earlier = seenDates.get(dateStr);
              if (earlier !== undefined) {
                dateError = earlier === rowIndex - 1
                  ? `Duplicate of the row above (${dateRaw})`
                  : `Duplicate of row ${earlier} (${dateRaw})`;
                dateCategory = 'duplicate_date';
              } else if (date.getMonth() !== pMonth || date.getFullYear() !== pYear) {
                dateError = 'Outside the 31-day period';
                dateCategory = 'outside_period';
              }
              // Track this date for later duplicate detection
              if (!seenDates.has(dateStr)) seenDates.set(dateStr, rowIndex);
            }

            if (dateError && dateCategory) {
              parsedRow.dateError = dateError;
              errors.push({ category: dateCategory, field: 'date', rowIndex, message: dateError });
            }

            // Unit cells — matched columns only
            for (const col of columns) {
              if (!col.matched) continue;
              const cellRaw = String(row[col.columnIndex] ?? '').trim();

              if (!cellRaw) {
                parsedRow.cellErrors[col.header] = 'Unit count is empty';
                errors.push({ category: 'invalid_unit_count', field: 'unit', rowIndex, column: col.header, message: parsedRow.cellErrors[col.header] });
                parsedRow.quantities[col.header] = 0;
                continue;
              }

              if (cellRaw.startsWith('-') || Number(cellRaw) < 0) {
                parsedRow.cellErrors[col.header] = "Units can't be negative";
                errors.push({ category: 'invalid_unit_count', field: 'unit', rowIndex, column: col.header, message: parsedRow.cellErrors[col.header] });
                parsedRow.quantities[col.header] = 0;
                continue;
              }

              if (!/^\d+$/.test(cellRaw)) {
                parsedRow.cellErrors[col.header] = 'Not a number';
                errors.push({ category: 'invalid_unit_count', field: 'unit', rowIndex, column: col.header, message: parsedRow.cellErrors[col.header] });
                parsedRow.quantities[col.header] = 0;
                continue;
              }

              parsedRow.quantities[col.header] = parseInt(cellRaw, 10);
            }

            rows.push(parsedRow);
          }

          resolve({
            columns,
            rows,
            matchedCount,
            unmatchedCount,
            errors,
            fileName: file.name
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

  private parseDate(raw: string): { dateStr: string; dateValid: boolean; date: Date | null } {
    if (!raw) return { dateStr: '', dateValid: false, date: null };

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
        return { dateStr: `${y}-${m}-${d}`, dateValid: true, date };
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
        return { dateStr: `${y}-${m}-${d}`, dateValid: true, date };
      }
    }

    return { dateStr: raw, dateValid: false, date: null };
  }
}
