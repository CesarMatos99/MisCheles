const DATABASE_NAME = 'mischeles-local-privacy';
const STORE_NAME = 'credentials';
const CREDENTIAL_KEY = 'local-pin';
const ITERATIONS = 310_000;
interface PinRecord { key: string; salt: string; verifier: string; iterations: number; }
let databasePromise: Promise<IDBDatabase> | undefined;
function database(): Promise<IDBDatabase> {
  if (!globalThis.indexedDB) return Promise.reject(new Error('El almacenamiento seguro del navegador no está disponible.'));
  databasePromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME, { keyPath: 'key' }); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('No se pudo abrir el almacenamiento local de privacidad.'));
  });
  return databasePromise;
}
function encode(bytes: Uint8Array): string { let binary = ''; bytes.forEach(byte => { binary += String.fromCharCode(byte); }); return btoa(binary); }
function decode(value: string): Uint8Array { return Uint8Array.from(atob(value), character => character.charCodeAt(0)); }
export function isValidLocalPin(pin: string): boolean { return /^\d{4}$/.test(pin); }
async function derive(pin: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  if (!globalThis.crypto?.subtle) throw new Error('La protección requiere un navegador seguro (HTTPS o localhost).');
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: Uint8Array.from(salt), iterations }, key, 256));
}
async function readRecord(): Promise<PinRecord | null> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(CREDENTIAL_KEY);
    request.onsuccess = () => resolve((request.result as PinRecord | undefined) || null);
    request.onerror = () => reject(request.error || new Error('No se pudo leer la configuración de privacidad.'));
  });
}
export const localLockCredential = {
  async hasPin(): Promise<boolean> { return Boolean(await readRecord()); },
  async setPin(pin: string): Promise<void> {
    if (!isValidLocalPin(pin)) throw new Error('El PIN debe tener exactamente 4 dígitos.');
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const verifier = await derive(pin, salt, ITERATIONS);
    const record: PinRecord = { key: CREDENTIAL_KEY, salt: encode(salt), verifier: encode(verifier), iterations: ITERATIONS };
    const db = await database();
    await new Promise<void>((resolve, reject) => {
      const request = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(record);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error || new Error('No se pudo guardar el PIN de privacidad.'));
    });
  },
  async verifyPin(pin: string): Promise<boolean> {
    if (!isValidLocalPin(pin)) return false;
    const record = await readRecord();
    if (!record) return false;
    const candidate = await derive(pin, decode(record.salt), record.iterations);
    const expected = decode(record.verifier);
    return candidate.length === expected.length && candidate.every((value, index) => value === expected[index]);
  },
};
