import { getWebAccessPassword, type WorkerEnv } from './env';
import { isValidSession } from './session';

export function getBearerPassword(request: Request): string | null {
  const auth = request.headers.get('Authorization')?.trim();
  if (!auth) {
    return null;
  }
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

export async function isPasswordAuthorized(
  request: Request,
  env: WorkerEnv,
  kv: KVNamespace,
): Promise<boolean> {
  const password = getWebAccessPassword(env);
  if (!password) {
    return false;
  }
  const bearer = getBearerPassword(request);
  if (bearer && bearer === password) {
    return true;
  }
  return isValidSession(request, password, kv);
}
