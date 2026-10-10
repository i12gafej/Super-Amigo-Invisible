export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}
export function field(data: Record<string, unknown>, key: string, min = 0, max = 4000, trim = true): string {
  const value = data[key];
  if (typeof value !== 'string' || value.length > max) throw new ApiError(400, 'Revisa el campo ' + key + '.');
  const result = trim ? value.trim() : value;
  if (result.length < min) throw new ApiError(400, 'Revisa el campo ' + key + '.');
  return result;
}
export function uuidField(data: Record<string, unknown>, key: string): string {
  const value = field(data, key, 36, 36);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new ApiError(400, 'Identificador inválido.');
  return value;
}
export function passwordField(data: Record<string, unknown>): string {
  const value = field(data, 'password', 1, 72, false);
  if (Buffer.byteLength(value, 'utf8') > 72) throw new ApiError(400, 'La contraseña no puede superar 72 bytes.');
  return value;
}
