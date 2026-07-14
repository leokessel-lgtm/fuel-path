import {
  Dispatch,
  SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { DurableWriteQueue, DurableWriteStatus } from "../services/durableWriteQueue.js";
import { RecoverableLoadResult } from "../services/recoverableLocalStore";

export type LocalPersistenceState = {
  status: "loading" | "saving" | "saved" | "recovered" | "error";
  message: string;
  savedAt?: string;
};

export function useRecoverableLocalState<T>({
  fallback,
  label,
  load,
  persist,
}: {
  fallback: T;
  label: string;
  load: () => Promise<RecoverableLoadResult<T>>;
  persist: (value: T) => Promise<void>;
}): {
  value: T;
  setValue: Dispatch<SetStateAction<T>>;
  loaded: boolean;
  persistence: LocalPersistenceState;
  retryPersistence: () => Promise<void>;
} {
  const [value, setValue] = useState<T>(fallback);
  const [loaded, setLoaded] = useState(false);
  const [persistence, setPersistence] = useState<LocalPersistenceState>({
    status: "loading",
    message: `Loading ${label}…`,
  });
  const mountedRef = useRef(true);
  const loadedRef = useRef(false);
  const loadFailedRef = useRef(false);
  const dirtyRef = useRef(false);
  const skipNextPersistRef = useRef(false);
  const valueRef = useRef(value);
  const queueRef = useRef<DurableWriteQueue<T> | null>(null);

  if (!queueRef.current) {
    queueRef.current = new DurableWriteQueue<T>(persist, (status) => {
      if (!mountedRef.current) return;
      setPersistence(writeStatus(label, status));
    });
  }

  const setDurableValue: Dispatch<SetStateAction<T>> = useCallback((action) => {
    setValue((current) => {
      const next = typeof action === "function"
        ? (action as (previous: T) => T)(current)
        : action;
      valueRef.current = next;
      if (!loadedRef.current || loadFailedRef.current) dirtyRef.current = true;
      return next;
    });
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    let active = true;
    const restore = async () => {
      try {
        const result = await load();
        if (!active) return;
        loadFailedRef.current = false;
        loadedRef.current = true;
        skipNextPersistRef.current = true;
        setLoaded(true);
        if (dirtyRef.current) {
          queueRef.current?.enqueue(valueRef.current);
          return;
        }
        valueRef.current = result.value;
        setValue(result.value);
        if (result.recovered || result.migratedLegacy) {
          setPersistence({
            status: "recovered",
            message: result.recovered ? `${label} recovered from the local backup.` : `${label} upgraded to durable storage.`,
          });
          queueRef.current?.enqueue(result.value);
        } else {
          setPersistence({ status: "saved", message: `${label} loaded.` });
        }
      } catch {
        if (!active) return;
        loadFailedRef.current = true;
        loadedRef.current = true;
        skipNextPersistRef.current = true;
        setLoaded(true);
        setPersistence({
          status: "error",
          message: `${label} could not be loaded. Changes are held in this session until storage is available.`,
        });
      }
    };
    void restore();
    return () => {
      active = false;
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    if (skipNextPersistRef.current) {
      skipNextPersistRef.current = false;
      return;
    }
    if (loadFailedRef.current) {
      dirtyRef.current = true;
      return;
    }
    queueRef.current?.enqueue(value);
  }, [loaded, value]);

  const retryPersistence = useCallback(async () => {
    if (!loadFailedRef.current) {
      queueRef.current?.retry();
      return;
    }
    setPersistence({ status: "loading", message: `Retrying ${label}…` });
    try {
      const result = await load();
      loadFailedRef.current = false;
      if (dirtyRef.current) {
        queueRef.current?.enqueue(valueRef.current);
      } else {
        skipNextPersistRef.current = true;
        valueRef.current = result.value;
        setValue(result.value);
        setPersistence({
          status: result.recovered ? "recovered" : "saved",
          message: result.recovered ? `${label} recovered from the local backup.` : `${label} loaded.`,
        });
        if (result.recovered || result.migratedLegacy) queueRef.current?.enqueue(result.value);
      }
    } catch {
      setPersistence({
        status: "error",
        message: `${label} is still unavailable. Your current session remains open.`,
      });
    }
  }, [label, load]);

  return { value, setValue: setDurableValue, loaded, persistence, retryPersistence };
}

function writeStatus(label: string, status: DurableWriteStatus): LocalPersistenceState {
  if (status.status === "saving") return { status: "saving", message: `Saving ${label}…` };
  if (status.status === "saved") {
    return { status: "saved", message: `${label} saved on this device.`, savedAt: status.savedAt };
  }
  return {
    status: "error",
    message: `${label} is not saved yet. Fuel Path will keep the latest change ready to retry.`,
  };
}
