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
    'SELECT id, name, subdomain, description, custom_domain, created_at FROM status_pages WHERE user_id = ? ORDER BY created_at DESC'
  ).bind(userId).all();

  return new Response(JSON.stringify(pages.results || []), {
    headers: { 'Content-Type': 'application/json' }
  });
};

export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime?.env;
  if (!env?.DB) return new Response('DB unavailable', { status: 500 });

  const userId = await getUserId(request, env);
  if (!userId) return new Response('Unauthorized', { status: 401 });

  const data = await request.json();
  if (!data.name || !data.subdomain) {
    return new Response('Name and subdomain required', { status: 400 });
  }

  const existing = await env.DB.prepare(
    'SELECT id FROM status_pages WHERE subdomain = ?'
  ).bind(data.subdomain).first();

  if (existing) {
    return new Response('Subdomain already taken', { status: 409 });
  }

  const id = crypto.randomUUID().replace(/-/g, '');
  await env.DB.prepare(`
    INSERT INTO status_pages (id, user_id, name, subdomain, description)
    VALUES (?, ?, ?, ?, ?)
  `).bind(id, userId, data.name, data.subdomain, data.description || '').run();

  return new Response(JSON.stringify({ id, name: data.name, subdomain: data.subdomain }), {
    headers: { 'Content-Type': 'application/json' }
  });
};
