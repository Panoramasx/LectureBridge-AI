import { getCachedValue, setCachedValue } from "./localDb";

const stableStringify = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, nested]) => `${JSON.stringify(key)}:${stableStringify(nested)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
};

const hash = (value: string) => {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(36);
};

export const cachedPost = async <T>(route: string, body: unknown, maxAgeMs?: number): Promise<T> => {
  const serialized = stableStringify(body);
  const key = `${route}:${hash(serialized)}`;
  const cached = await getCachedValue<T>(key, maxAgeMs);
  if (cached !== undefined) return cached;

  const response = await fetch(route, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok || data?.success === false) {
    throw new Error(data?.error || `Request failed: ${route}`);
  }
  await setCachedValue(key, data);
  return data as T;
};
