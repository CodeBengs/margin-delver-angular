export interface SalesUploadResult {
  sales_upload_id: number;
  period_days: number;
  matched_item_count: number;
  ignored_columns: string[];
  warnings: string[];
}

export interface SalesPreviewRow {
  date: string;
  quantities: Record<string, number>;
}

