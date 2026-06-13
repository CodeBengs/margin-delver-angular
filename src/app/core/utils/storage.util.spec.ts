import { storageGet, storageSet, storageRemove } from './storage.util';

describe('storage.util', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  describe('happy path', () => {
    it('sets and gets a value', () => {
      expect(storageSet('k', 'v')).toBeTrue();
      expect(storageGet('k')).toBe('v');
    });

    it('returns null for a missing key', () => {
      expect(storageGet('missing')).toBeNull();
    });

    it('removes a value', () => {
      storageSet('k', 'v');
      storageRemove('k');
      expect(storageGet('k')).toBeNull();
    });
  });

  describe('when localStorage throws', () => {
    it('storageGet returns null', () => {
      spyOn(localStorage, 'getItem').and.throwError('blocked');
      expect(storageGet('k')).toBeNull();
    });

    it('storageSet returns false', () => {
      spyOn(localStorage, 'setItem').and.throwError('quota');
      expect(storageSet('k', 'v')).toBeFalse();
    });

    it('storageRemove swallows the error', () => {
      spyOn(localStorage, 'removeItem').and.throwError('blocked');
      expect(() => storageRemove('k')).not.toThrow();
    });
  });
});
