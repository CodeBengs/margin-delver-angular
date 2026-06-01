export type IngredientUnit = 'gram' | 'ml' | 'butir' | 'lembar' | 'siung' | 'buah' | 'sdm' | 'sdt' | 'porsi';
export type IngredientCostSource = 'price_list' | 'manual' | 'unknown';

export interface Ingredient {
  id?: number;
  name: string;
  quantity: number;
  unit: IngredientUnit;
  unit_cost_idr: number | null;
  total_cost_idr: number | null;
  cost_source: IngredientCostSource;
}

