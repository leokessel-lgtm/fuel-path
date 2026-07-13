export function randomUuid(): Promise<string>;
export function randomSecret(): Promise<string>;
export function secureGet(key: string): Promise<string | null>;
export function secureSet(key: string, value: string): Promise<void>;
export function secureDelete(key: string): Promise<void>;
