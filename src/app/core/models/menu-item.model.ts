import { Ingredient } from './ingredient.model';

export type MenuItemStatus = 'draft' | 'estimating' | 'ready' | 'unrecognised' | 'incomplete' | 'failed';

export interface MenuSession {
  session_key: string;
  status: 'draft' | 'estimated' | 'analysed';
}

export interface MenuItem {
  id?: number;
  name: string;
  alternative_name?: string | null;
  selling_price_idr: number;
  est_cost_idr?: number | null;
  gross_margin_idr?: number | null;
  gross_margin_pct?: number | null;
  status: MenuItemStatus;
  ingredients?: Ingredient[];
  retryCount?: number;
  _error?: string;
  /** Set once the user hand-edits ingredients, so AI "Estimate margins" won't overwrite their work. */
  manualEntry?: boolean;
}

export interface MenuUploadResult {
  items_detected: number;
  header_detected: boolean;
  warnings: string[];
  items: MenuItem[];
}

export interface EstimateMarginsResult {
  estimated_count: number;
  unrecognised_count: number;
  incomplete_count: number;
  items: MenuItem[];
}

