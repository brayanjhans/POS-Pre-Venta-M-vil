import { Preferences } from '@capacitor/preferences';

/**
 * Almacenamiento persistente del dispositivo. En Android usa SharedPreferences
 * (no se borra como el localStorage del WebView); en navegador cae a localStorage.
 */
export const storage = {
  async get<T>(key: string): Promise<T | null> {
    try {
      const { value } = await Preferences.get({ key });
      return value ? (JSON.parse(value) as T) : null;
    } catch {
      return null;
    }
  },
  async set(key: string, value: unknown): Promise<void> {
    await Preferences.set({ key, value: JSON.stringify(value) });
  },
  async remove(key: string): Promise<void> {
    await Preferences.remove({ key });
  },
};

export const KEYS = {
  session: 'pos.session',
  catalog: 'pos.catalog',
  loginUsers: 'pos.loginUsers',
  lastUsername: 'pos.lastUsername',
  orders: (userId: string) => `pos.orders.${userId}`,
  outbox: (userId: string) => `pos.outbox.${userId}`,
  cart: (userId: string) => `pos.cart.${userId}`,
};
