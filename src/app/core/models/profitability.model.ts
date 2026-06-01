export type ProfitabilityVerdict = 'profitable' | 'break_even' | 'loss';
export type ItemClassification = 'star' | 'workhorse' | 'niche' | 'deadweight';
export type SuggestionType = 'bundle' | 'sunset' | 'reprice' | 'promote' | 'ingredient_swap';

export interface ProfitabilitySummary {
  total_revenue_idr: number;
  total_cost_idr: number;
  total_gross_profit_idr: number;
  overall_margin_pct: number;
  verdict: ProfitabilityVerdict;
  verdict_summary: string;
}

export interface ProfitabilityItem {
  menu_item: string;
  units_sold: number;
  revenue_idr: number;
  est_cost_idr: number;
  contribution_idr: number;
  margin_pct: number;
  classification: ItemClassification;
}

export interface AiSuggestion {
  id?: number;
  suggestion_type: SuggestionType;
  title: string;
  description: string;
  items_involved: string[];
  estimated_impact: string;
  review_status?: 'new' | 'understood' | 'dismissed';
}

export interface ProfitabilityAnalysisResult {
  summary: ProfitabilitySummary;
  items: ProfitabilityItem[];
  suggestions: AiSuggestion[];
}

