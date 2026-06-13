import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { lastValueFrom } from 'rxjs';

import { IngredientPriceService, PriceEntry } from './ingredient-price.service';

const ENTRIES: PriceEntry[] = [
  { name: 'Beras', aliases: ['nasi'], unit: 'gram', price_idr: 12 },
  { name: 'Telur', aliases: ['telor'], unit: 'butir', price_idr: 2500 }
];

describe('IngredientPriceService', () => {
  let service: IngredientPriceService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(IngredientPriceService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  function loadAndFlush(): Promise<void> {
    const promise = lastValueFrom(service.loadPrices());
    httpMock.expectOne('assets/prices-idr.json').flush(ENTRIES);
    return promise;
  }

  it('loads prices once and caches them (no second request)', async () => {
    await loadAndFlush();
    // Second call must not hit the network — afterEach verify() would fail otherwise.
    await lastValueFrom(service.loadPrices());
    expect(service.lookup('Beras', 'gram')).toBe(12);
  });

  describe('lookup', () => {
    beforeEach(() => loadAndFlush());

    it('matches by exact name and unit', () => {
      expect(service.lookup('Telur', 'butir')).toBe(2500);
    });

    it('matches by alias (case-insensitive)', () => {
      expect(service.lookup('TELOR', 'butir')).toBe(2500);
    });

    it('falls back to name match when the unit does not match', () => {
      expect(service.lookup('Beras', 'kilogram')).toBe(12);
    });

    it('returns null for an unknown ingredient', () => {
      expect(service.lookup('Saffron')).toBeNull();
    });
  });
});
