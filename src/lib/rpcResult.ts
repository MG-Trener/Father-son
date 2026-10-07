export type RpcRecord = Record<string, unknown>;

export const asRpcRecord = (value: unknown): RpcRecord | null => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as RpcRecord
    : null
);

export const rpcString = (value: unknown, key: string): string | null => {
  const record = asRpcRecord(value);
  const field = record?.[key];
  return typeof field === 'string' && field.length > 0 ? field : null;
};

export const rpcNumber = (value: unknown, key: string): number | null => {
  const record = asRpcRecord(value);
  const field = record?.[key];
  return typeof field === 'number' && Number.isFinite(field) ? field : null;
};

export const rpcBoolean = (value: unknown, key: string): boolean | null => {
  const record = asRpcRecord(value);
  const field = record?.[key];
  return typeof field === 'boolean' ? field : null;
};

export const requireRpcString = (value: unknown, key: string, errorCode = 'RPC_RESULT_INVALID'): string => {
  const result = rpcString(value, key);
  if (!result) throw new Error(`${errorCode}:${key}`);
  return result;
};

export const rpcStringArray = (value: unknown, key: string): string[] => {
  const record = asRpcRecord(value);
  const field = record?.[key];
  if (!Array.isArray(field)) return [];
  return field.filter((item): item is string => typeof item === 'string');
};
