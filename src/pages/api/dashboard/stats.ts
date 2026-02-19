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

  const pages = await env.DB.prepare(
    'SELECT COUNT(*) as count FROM status_pages WHERE user_id = ?'
  ).bind(userId).first();

  const components = await env.DB.prepare(
    'SELECT COUNT(*) as count FROM components WHERE status_page_id IN (SELECT id FROM status_pages WHERE user_id = ?)'
  ).bind(userId).first();

  const activeIncidents = await env.DB.prepare(
    `SELECT COUNT(*) as count FROM incidents WHERE status_page_id IN (SELECT id FROM status_pages WHERE user_id = ?) AND status != 'resolved'`
  ).bind(userId).first();

  const subscribers = await env.DB.prepare(
    'SELECT COUNT(*) as count FROM subscribers WHERE status_page_id IN (SELECT id FROM status_pages WHERE user_id = ?)'
  ).bind(userId).first();

  return new Response(JSON.stringify({
    pages: pages?.count || 0,
    components: components?.count || 0,
    activeIncidents: activeIncidents?.count || 0,
    subscribers: subscribers?.count || 0
  }), { headers: { 'Content-Type': 'application/json' } });
};
