import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import * as XLSX from 'xlsx';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api-response.model';
import { ProfitabilityAnalysisResult } from '../models/profitability.model';
import { SalesUploadResult } from '../models/sales-data.model';

export interface SalesParseError {
  title: string;
  message: string;
  details: string[];
  popup: boolean;
}

export interface SalesParseResult {
  salesById: Record<number, number>;
  error?: SalesParseError;
}

@Injectable({ providedIn: 'root' })
export class SalesService {
  private readonly apiBaseUrl = environment.apiBaseUrl;

  constructor(private readonly http: HttpClient) {}

  uploadSales(sessionKey: string, file: File): Observable<SalesUploadResult> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http
      .post<ApiResponse<SalesUploadResult>>(`${this.apiBaseUrl}/menu-sessions/${sessionKey}/sales-upload`, formData)
      .pipe(map((response) => response.result));
  }

  analyseSales(salesUploadId: number): Observable<ProfitabilityAnalysisResult> {
    return this.http
      .post<ApiResponse<ProfitabilityAnalysisResult>>(`${this.apiBaseUrl}/sales-uploads/${salesUploadId}/analyse`, {})
      .pipe(map((response) => response.result));
  }

  async parseFile(
    file: File,
    menuItems: { id: number; name: string }[]
  ): Promise<SalesParseResult> {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'xlsx' && ext !== 'xls') {
      return this.popupError(
        'Unsupported file format',
        `"${file.name}" is not a supported format. Please upload an .xlsx or .xls file.`
      );
    }

    let buffer: ArrayBuffer;
    try {
      buffer = await this.readFileAsBuffer(file);
    } catch {
      return this.inlineError('Failed to read file.');
    }

    try {
      const data    = new Uint8Array(buffer);
      const wb      = XLSX.read(data, { type: 'array' });
      const ws      = wb.Sheets[wb.SheetNames[0]];
      const rows    = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 }) as (string | number)[][];

      if (rows.length < 2) {
        return this.inlineError('File is empty or has no data rows.');
      }

      const headers    = (rows[0] as unknown[]).map((h) => String(h ?? '').trim().toLowerCase());
      const dateColIdx = headers.findIndex((h) => h === 'date');
      if (dateColIdx === -1) {
        return this.inlineError('Column "Date" not found in the first row.');
      }

      // Non-date, non-empty column indices
      const menuColIndices = headers
        .map((_h, i) => i)
        .filter((i) => i !== dateColIdx && headers[i] !== '');

      // Duplicate menu column names
      const seenNames = new Set<string>();
      const dupNames: string[] = [];
      for (const name of menuColIndices.map((i) => headers[i])) {
        if (seenNames.has(name)) { if (!dupNames.includes(name)) dupNames.push(name); }
        else seenNames.add(name);
      }
      if (dupNames.length > 0) {
        return this.popupError(
          'Duplicate menu names',
          'Each menu column must have a unique name. Please fix the headers below and re-upload.',
          dupNames
        );
      }

      // Row count
      const dataRows = rows.slice(1);
      if (dataRows.length > 31) {
        return this.popupError(
          'Too many rows',
          `The file has ${dataRows.length} data rows. Maximum is 31 rows (one full month).`
        );
      }

      // Date format (DD/MM/YYYY); Excel serial numbers are valid
      const dateRegex = /^\d{2}\/\d{2}\/\d{4}$/;
      const badDates: string[] = [];
      for (let r = 0; r < dataRows.length; r++) {
        const cell = dataRows[r][dateColIdx];
        if (typeof cell === 'number') continue;
        const dateStr = String(cell ?? '').trim();
        if (dateStr && !dateRegex.test(dateStr)) {
          badDates.push(`Row ${r + 2}: "${dateStr}"`);
        }
      }
      if (badDates.length > 0) {
        const details = badDates.slice(0, 5);
        if (badDates.length > 5) details.push(`… and ${badDates.length - 5} more rows`);
        return this.popupError('Invalid date format', 'The Date column must use DD/MM/YYYY format.', details);
      }

      // Duplicate dates
      const seenDates = new Set<string>();
      const dupDates: string[] = [];
      for (let r = 0; r < dataRows.length; r++) {
        const dateStr = String(dataRows[r][dateColIdx] ?? '').trim();
        if (!dateStr) continue;
        if (seenDates.has(dateStr)) { if (!dupDates.includes(dateStr)) dupDates.push(dateStr); }
        else seenDates.add(dateStr);
      }
      if (dupDates.length > 0) {
        const details = dupDates.slice(0, 5);
        if (dupDates.length > 5) details.push(`… and ${dupDates.length - 5} more`);
        return this.popupError(
          'Duplicate dates found',
          'Each date must appear only once. Please fix the rows below and re-upload.',
          details
        );
      }

      // Parse sales — silently cap at first 20 menu columns (B–U)
      const allowedColSet = new Set(menuColIndices.slice(0, 20));
      const rawSales: Record<string, number> = {};
      for (let r = 1; r < rows.length; r++) {
        const row = rows[r] as (string | number)[];
        for (let c = 0; c < headers.length; c++) {
          if (!allowedColSet.has(c)) continue;
          const val = Number(row[c] ?? 0);
          rawSales[headers[c]] = (rawSales[headers[c]] ?? 0) + (isNaN(val) ? 0 : val);
        }
      }

      // Match column names to menu item IDs (case-insensitive)
      const salesById: Record<number, number> = {};
      for (const item of menuItems) {
        const key = item.name.trim().toLowerCase();
        if (rawSales[key] !== undefined) salesById[item.id] = rawSales[key];
      }

      return { salesById };
    } catch {
      return this.inlineError('Failed to read file. Make sure it is .xlsx or .xls format.');
    }
  }

  private readFileAsBuffer(file: File): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = (e) => resolve(e.target!.result as ArrayBuffer);
      reader.onerror = () => reject();
      reader.readAsArrayBuffer(file);
    });
  }

  private inlineError(message: string): SalesParseResult {
    return { salesById: {}, error: { title: '', message, details: [], popup: false } };
  }

  private popupError(title: string, message: string, details: string[] = []): SalesParseResult {
    return { salesById: {}, error: { title, message, details, popup: true } };
  }
}
