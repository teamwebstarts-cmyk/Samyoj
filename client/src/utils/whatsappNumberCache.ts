const store = new Map<string, Map<string, unknown>>();

export function readNumberCache<T>(pageKey: string, numberId: string): T | undefined {
  return store.get(pageKey)?.get(numberId) as T | undefined;
}

export function writeNumberCache<T>(pageKey: string, numberId: string, value: T) {
  if (!store.has(pageKey)) store.set(pageKey, new Map());
  store.get(pageKey)!.set(numberId, value);
}

export function clearNumberCache(pageKey: string, numberId?: string) {
  if (numberId) {
    store.get(pageKey)?.delete(numberId);
    return;
  }
  store.delete(pageKey);
}
