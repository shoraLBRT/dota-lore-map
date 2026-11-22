import { afterEach, describe, expect, it } from 'vitest';
import { navNew } from './flags';

describe('флаг ?nav=new', () => {
  afterEach(() => window.history.replaceState(null, '', '/'));

  it('включён только значением new в поиске адреса до hash', () => {
    expect(navNew()).toBe(false);
    window.history.replaceState(null, '', '/?nav=new#/world');
    expect(navNew()).toBe(true);
    window.history.replaceState(null, '', '/?nav=old#/world');
    expect(navNew()).toBe(false);
    // В hash флаг не считается: это параметры маршрута (A5).
    window.history.replaceState(null, '', '/#/world?nav=new');
    expect(navNew()).toBe(false);
  });
});
