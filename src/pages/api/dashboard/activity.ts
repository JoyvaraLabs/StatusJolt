import type { APIRoute } from 'astro';
import { jwtVerify } from 'jose';

async function getUserId(request: Request, env: any): Promise<string | null> {
  const cookie = request.headers.get('cookie') || '';
  const tokenMatch = cookie.match(/auth-token=([^;]+)/);
  if (!tokenMatch) return null;
  try {
    const secret = new TextEncoder().encode(env.JWT_SECRET || 'fallback-jwt-secret');
    const { payload } = await jwtVerify(tokenMatch[1], secret);
    return payload.userId as string;
  } catch { return null; }
}

export const GET: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime?.env;
  if (!env?.DB) return new Response('DB unavailable', { status: 500 });

  const userId = await getUserId(request, env);
  if (!userId) return new Response('Unauthorized', { status: 401 });

  const incidents = await env.DB.prepare(`
    SELECT i.title as message, i.created_at, 'incident' as type
    FROM incidents i
    JOIN status_pages sp ON i.status_page_id = sp.id
    WHERE sp.user_id = ?
    ORDER BY i.created_at DESC
    LIMIT 10
  `).bind(userId).all();

  return new Response(JSON.stringify(incidents.results || []), {
    headers: { 'Content-Type': 'application/json' }
  });
};
