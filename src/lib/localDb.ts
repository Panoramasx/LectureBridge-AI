import type { LectureSession } from "../types";

const DB_NAME = "lecturebridge-ai";
const DB_VERSION = 1;
const SESSION_STORE = "sessions";
const CACHE_STORE = "cache";
const ACTIVE_SESSION_PREFIX = "lecturebridge-active-session:";

interface CacheRecord {
  key: string;
  value: unknown;
  createdAt: number;
}

const openDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SESSION_STORE)) {
        const sessions = db.createObjectStore(SESSION_STORE, { keyPath: "id" });
        sessions.createIndex("courseId", "courseId", { unique: false });
        sessions.createIndex("updatedAt", "updatedAt", { unique: false });
      }
      if (!db.objectStoreNames.contains(CACHE_STORE)) {
        db.createObjectStore(CACHE_STORE, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Unable to open local database."));
  });

const requestResult = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB operation failed."));
  });

export const saveSession = async (session: LectureSession) => {
  const db = await openDb();
  const transaction = db.transaction(SESSION_STORE, "readwrite");
  transaction.objectStore(SESSION_STORE).put(session);
  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
};

export const getSession = async (id: string) => {
  const db = await openDb();
  const result = await requestResult<LectureSession | undefined>(
    db.transaction(SESSION_STORE, "readonly").objectStore(SESSION_STORE).get(id),
  );
  db.close();
  return result;
};

export const listCourseSessions = async (courseId: string) => {
  const db = await openDb();
  const result = await requestResult<LectureSession[]>(
    db.transaction(SESSION_STORE, "readonly").objectStore(SESSION_STORE).index("courseId").getAll(courseId),
  );
  db.close();
  return result.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
};

export const deleteSession = async (id: string) => {
  const db = await openDb();
  const transaction = db.transaction(SESSION_STORE, "readwrite");
  transaction.objectStore(SESSION_STORE).delete(id);
  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
};

export const setActiveSessionId = (courseId: string, sessionId: string) =>
  localStorage.setItem(`${ACTIVE_SESSION_PREFIX}${courseId}`, sessionId);

export const getActiveSessionId = (courseId: string) =>
  localStorage.getItem(`${ACTIVE_SESSION_PREFIX}${courseId}`);

export const getCachedValue = async <T>(key: string, maxAgeMs = 7 * 24 * 60 * 60 * 1000) => {
  const db = await openDb();
  const record = await requestResult<CacheRecord | undefined>(
    db.transaction(CACHE_STORE, "readonly").objectStore(CACHE_STORE).get(key),
  );
  db.close();
  if (!record || Date.now() - record.createdAt > maxAgeMs) return undefined;
  return record.value as T;
};

export const setCachedValue = async (key: string, value: unknown) => {
  const db = await openDb();
  const transaction = db.transaction(CACHE_STORE, "readwrite");
  transaction.objectStore(CACHE_STORE).put({ key, value, createdAt: Date.now() } satisfies CacheRecord);
  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
};
