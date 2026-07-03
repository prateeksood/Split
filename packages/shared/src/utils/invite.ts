const INVITE_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateInviteCode(length = 8): string {
  // Use crypto-strong random bytes for unguessable invite codes.
  const crypto = globalThis.crypto;
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => INVITE_CODE_CHARS[b % INVITE_CODE_CHARS.length])
    .join('');
}

export function normalizeInviteCode(code: string): string {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** @deprecated Use server-side buildInviteLink with APP_URL instead. Kept for client-side fallback only. */
export function buildGroupInviteLink(code: string, baseUrl = 'split://join-group'): string {
  return `${baseUrl}?code=${encodeURIComponent(normalizeInviteCode(code))}`;
}

export function parseInviteCodeFromInput(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (/^[A-Za-z0-9]{6,12}$/.test(trimmed)) {
    return normalizeInviteCode(trimmed);
  }

  try {
    const url = trimmed.includes('://') ? new URL(trimmed) : new URL(`split://${trimmed.replace(/^\/+/, '')}`);
    const fromQuery = url.searchParams.get('code');
    if (fromQuery) return normalizeInviteCode(fromQuery);

    const pathMatch = url.pathname.match(/\/join(?:-group)?\/([A-Za-z0-9]+)/i);
    if (pathMatch?.[1]) return normalizeInviteCode(pathMatch[1]);
  } catch {
    // not a URL — fall through
  }

  const extracted = trimmed.match(/code=([A-Za-z0-9]+)/i);
  if (extracted?.[1]) return normalizeInviteCode(extracted[1]);

  return null;
}
