// Same-origin JSON calls to the MatchBee API (src/core.ts). Never throws: network errors come back as status 0.
// T is the body the endpoint sends on success; error answers carry error/message instead.
export type ApiErrorFields = { error?: string; message?: string };
export type ApiResult<T = ApiErrorFields> = { ok: boolean; status: number; j: T & ApiErrorFields };

export async function api<T = ApiErrorFields>(method: string, path: string, body?: unknown, signal?: AbortSignal): Promise<ApiResult<T>> {
  try {
    const r = await fetch(path, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), credentials: 'same-origin', signal });
    const j: unknown = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, j: j as T & ApiErrorFields }; // the server's answer for this endpoint
  } catch (e: unknown) {
    if (e instanceof Error && e.name === 'AbortError') throw e;
    return { ok: false, status: 0, j: { message: 'Could not reach the server. Check your connection.' } as T & ApiErrorFields };
  }
}

/** The message of a thrown value, or the fallback when it has none. */
export const errMsg = (e: unknown, fallback: string): string => (e instanceof Error && e.message) || fallback;

export type User = { id: string; email: string; plan: string; first: string; last: string; created: number; verified: boolean; password: boolean; google: boolean };
export type Config = { accounts: boolean; password: boolean; reset: boolean; google: boolean; email: boolean; features: Record<string, boolean> };
