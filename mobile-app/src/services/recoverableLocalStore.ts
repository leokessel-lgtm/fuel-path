import AsyncStorage from "@react-native-async-storage/async-storage";

type LocalEnvelope<T> = {
  schemaVersion: 1;
  revision: number;
  writtenAt: string;
  checksum: string;
  payload: T;
};

export type RecoverableLoadResult<T> = {
  value: T;
  source: "primary" | "backup" | "default";
  recovered: boolean;
  migratedLegacy: boolean;
};

let lastRevision = 0;

export async function loadRecoverableJson<T>({
  primaryKey,
  backupKey,
  fallback,
  normalise,
}: {
  primaryKey: string;
  backupKey: string;
  fallback: T;
  normalise: (value: unknown) => T;
}): Promise<RecoverableLoadResult<T>> {
  const pairs = await AsyncStorage.multiGet([primaryKey, backupKey]);
  const primaryRaw = pairs.find(([key]) => key === primaryKey)?.[1] ?? null;
  const backupRaw = pairs.find(([key]) => key === backupKey)?.[1] ?? null;
  if (primaryRaw == null && backupRaw == null) {
    return { value: fallback, source: "default", recovered: false, migratedLegacy: false };
  }

  const candidates = [
    decodeCandidate(primaryRaw, "primary", normalise),
    decodeCandidate(backupRaw, "backup", normalise),
  ].filter((candidate): candidate is DecodedCandidate<T> => candidate != null);
  if (!candidates.length) throw new Error("Stored local data is unreadable");
  candidates.sort((left, right) => right.revision - left.revision || (left.source === "primary" ? -1 : 1));
  const selected = candidates[0];
  return {
    value: selected.value,
    source: selected.source,
    recovered: selected.source === "backup" || (primaryRaw != null && candidates.every((item) => item.source !== "primary")),
    migratedLegacy: selected.legacy,
  };
}

export async function persistRecoverableJson<T>({
  primaryKey,
  backupKey,
  value,
}: {
  primaryKey: string;
  backupKey: string;
  value: T;
}) {
  const current = await AsyncStorage.multiGet([primaryKey, backupKey]);
  const persistedRevision = current.reduce(
    (highest, [, raw]) => Math.max(highest, envelopeRevision(raw)),
    0,
  );
  const revision = nextRevision(persistedRevision);
  const payloadJson = JSON.stringify(value);
  const envelope: LocalEnvelope<T> = {
    schemaVersion: 1,
    revision,
    writtenAt: new Date().toISOString(),
    checksum: checksum(payloadJson),
    payload: value,
  };
  const encoded = JSON.stringify(envelope);
  await AsyncStorage.multiSet([[backupKey, encoded], [primaryKey, encoded]]);
  const verified = await AsyncStorage.multiGet([primaryKey, backupKey]);
  if (verified.length !== 2 || !verified.every(([, raw]) => raw === encoded)) {
    throw new Error("Local data write verification failed");
  }
}

type DecodedCandidate<T> = {
  value: T;
  source: "primary" | "backup";
  revision: number;
  legacy: boolean;
};

function decodeCandidate<T>(
  raw: string | null,
  source: "primary" | "backup",
  normalise: (value: unknown) => T,
): DecodedCandidate<T> | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (isEnvelope(parsed)) {
      const payloadJson = JSON.stringify(parsed.payload);
      if (parsed.checksum !== checksum(payloadJson)) return null;
      return { value: normalise(parsed.payload), source, revision: parsed.revision, legacy: false };
    }
    return { value: normalise(parsed), source, revision: 0, legacy: true };
  } catch {
    return null;
  }
}

function isEnvelope(value: unknown): value is LocalEnvelope<unknown> {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<LocalEnvelope<unknown>>;
  return candidate.schemaVersion === 1
    && Number.isSafeInteger(candidate.revision)
    && Number(candidate.revision) > 0
    && Number(candidate.revision) < Number.MAX_SAFE_INTEGER
    && typeof candidate.writtenAt === "string"
    && typeof candidate.checksum === "string"
    && "payload" in candidate;
}

function envelopeRevision(raw: string | null) {
  if (!raw) return 0;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isEnvelope(parsed)) return 0;
    if (parsed.checksum !== checksum(JSON.stringify(parsed.payload))) return 0;
    return parsed.revision;
  } catch {
    return 0;
  }
}

function nextRevision(persistedRevision = 0) {
  const clockRevision = Date.now() * 1000;
  lastRevision = Math.max(clockRevision, lastRevision + 1, persistedRevision + 1);
  return lastRevision;
}

function checksum(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
