import { HttpClient } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { map, Observable, tap } from 'rxjs';

export interface PriceEntry {
  name: string;
  aliases: string[];
  unit: string;
  price_idr: number;
}

@Injectable({ providedIn: 'root' })
export class IngredientPriceService {
  private readonly prices = signal<PriceEntry[]>([]);
  private loaded = false;

  constructor(private readonly http: HttpClient) {}

  loadPrices(): Observable<void> {
    if (this.loaded) {
      return new Observable<void>((observer) => {
        observer.next();
        observer.complete();
      });
    }
    return this.http.get<PriceEntry[]>('assets/prices-idr.json').pipe(
      tap((entries) => {
        this.prices.set(entries);
        this.loaded = true;
      }),
      map(() => undefined)
    );
  }

  lookup(name: string, unit: string): number | null {
    const normalizedName = name.trim().toLowerCase();
    const normalizedUnit = unit.trim().toLowerCase();
    const entries = this.prices();

    for (const entry of entries) {
      const entryUnit = entry.unit.trim().toLowerCase();
      if (entryUnit !== normalizedUnit) continue;

      if (entry.name.trim().toLowerCase() === normalizedName) {
        return entry.price_idr;
      }
      for (const alias of entry.aliases) {
        if (alias.trim().toLowerCase() === normalizedName) {
          return entry.price_idr;
        }
      }
    }

    // Try without unit constraint as fallback
    for (const entry of entries) {
      if (entry.name.trim().toLowerCase() === normalizedName) {
        return entry.price_idr;
      }
      for (const alias of entry.aliases) {
        if (alias.trim().toLowerCase() === normalizedName) {
          return entry.price_idr;
        }
      }
    }

    return null;
  }
}
