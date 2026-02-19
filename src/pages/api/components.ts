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

async function verifyStatusPageOwnership(env: any, statusPageId: string, userId: string): Promise<boolean> {
  const page = await env.DB.prepare(
    'SELECT id FROM status_pages WHERE id = ? AND user_id = ?'
  ).bind(statusPageId, userId).first();
  return !!page;
}

export const GET: APIRoute = async ({ url, request, locals }) => {
  const env = locals.runtime?.env;
  if (!env?.DB) return new Response('DB unavailable', { status: 500 });

  const userId = await getUserId(request, env);
  if (!userId) return new Response('Unauthorized', { status: 401 });

  const statusPageId = url.searchParams.get('status_page_id');
  if (!statusPageId) return new Response('status_page_id parameter required', { status: 400 });

  // Verify user owns the status page
  if (!(await verifyStatusPageOwnership(env, statusPageId, userId))) {
    return new Response('Status page not found', { status: 404 });
  }

  const components = await env.DB.prepare(
    `SELECT id, name, description, status, position, created_at, updated_at 
     FROM components WHERE status_page_id = ? ORDER BY position ASC, created_at ASC`
  ).bind(statusPageId).all();

  return new Response(JSON.stringify(components.results || []), {
    headers: { 'Content-Type': 'application/json' }
  });
};

export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime?.env;
  if (!env?.DB) return new Response('DB unavailable', { status: 500 });

  const userId = await getUserId(request, env);
  if (!userId) return new Response('Unauthorized', { status: 401 });

  const data = await request.json();
  if (!data.status_page_id || !data.name) {
    return new Response('status_page_id and name required', { status: 400 });
  }

  // Verify user owns the status page
  if (!(await verifyStatusPageOwnership(env, data.status_page_id, userId))) {
    return new Response('Status page not found', { status: 404 });
  }

  const id = crypto.randomUUID().replace(/-/g, '');
  
  await env.DB.prepare(`
    INSERT INTO components (id, status_page_id, name, description, status, position)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
    id, 
    data.status_page_id, 
    data.name, 
    data.description || '', 
    data.status || 'operational',
    data.position || 0
  ).run();

  return new Response(JSON.stringify({ 
    id, 
    name: data.name, 
    description: data.description,
    status: data.status || 'operational',
    position: data.position || 0
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
};