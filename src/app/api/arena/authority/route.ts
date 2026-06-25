import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

async function fetchAuthorityHealth(url: string, token?: string): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2_000);
  try {
    const res = await fetch(url, {
      cache: 'no-store',
      signal: controller.signal,
      headers: token ? { authorization: `Bearer ${token}` } : undefined,
    });
    if (!res.ok) return false;
    const json = (await res.json().catch(() => null)) as { ok?: unknown; authority?: unknown } | null;
    return json?.ok === true && json.authority === 'arena';
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET() {
  if (process.env.ARENA_AUTHORITY_ENABLED !== 'true') {
    return NextResponse.json({ enabled: false, reason: 'server_disabled' }, { headers: { 'cache-control': 'no-store' } });
  }

  const statusUrl = process.env.ARENA_AUTHORITY_STATUS_URL;
  const hasRealtime = Boolean(process.env.NEXT_PUBLIC_API_URL);
  if (!statusUrl) {
    return NextResponse.json(
      { enabled: hasRealtime, reason: hasRealtime ? 'backend_realtime' : 'missing_status_url' },
      { headers: { 'cache-control': 'no-store' } },
    );
  }

  const healthy = await fetchAuthorityHealth(statusUrl, process.env.ARENA_AUTHORITY_STATUS_TOKEN);
  return NextResponse.json(
    { enabled: healthy, reason: healthy ? 'ready' : 'health_check_failed' },
    { headers: { 'cache-control': 'no-store' } },
  );
}
