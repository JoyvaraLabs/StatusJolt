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

export const GET: APIRoute = async ({ params, request, locals }) => {
  const env = locals.runtime?.env;
  if (!env?.DB) return new Response('DB unavailable', { status: 500 });

  const userId = await getUserId(request, env);
  if (!userId) return new Response('Unauthorized', { status: 401 });

  const { id } = params;
  if (!id) return new Response('ID required', { status: 400 });

  const page = await env.DB.prepare(
    `SELECT id, name, subdomain, description, custom_domain, primary_color, is_public, created_at 
     FROM status_pages WHERE id = ? AND user_id = ?`
  ).bind(id, userId).first();

  if (!page) {
    return new Response('Status page not found', { status: 404 });
  }

  return new Response(JSON.stringify(page), {
    headers: { 'Content-Type': 'application/json' }
  });
};

export const PUT: APIRoute = async ({ params, request, locals }) => {
  const env = locals.runtime?.env;
  if (!env?.DB) return new Response('DB unavailable', { status: 500 });

  const userId = await getUserId(request, env);
  if (!userId) return new Response('Unauthorized', { status: 401 });

  const { id } = params;
  if (!id) return new Response('ID required', { status: 400 });

  const data = await request.json();

  // Verify the page belongs to the user
  const page = await env.DB.prepare(
    'SELECT id FROM status_pages WHERE id = ? AND user_id = ?'
  ).bind(id, userId).first();

  if (!page) {
    return new Response('Status page not found', { status: 404 });
  }

  // Check if subdomain is unique (excluding current page)
  if (data.subdomain) {
    const existing = await env.DB.prepare(
      'SELECT id FROM status_pages WHERE subdomain = ? AND id != ?'
    ).bind(data.subdomain, id).first();

    if (existing) {
      return new Response('Subdomain already taken', { status: 409 });
    }
  }

  await env.DB.prepare(`
    UPDATE status_pages 
    SET name = COALESCE(?, name),
        subdomain = COALESCE(?, subdomain),
        description = COALESCE(?, description),
        primary_color = COALESCE(?, primary_color),
        is_public = COALESCE(?, is_public),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND user_id = ?
  `).bind(
    data.name,
    data.subdomain,
    data.description,
    data.primary_color,
    data.is_public,
    id,
    userId
  ).run();

  return new Response('Updated successfully');
};

export const DELETE: APIRoute = async ({ params, request, locals }) => {
  const env = locals.runtime?.env;
  if (!env?.DB) return new Response('DB unavailable', { status: 500 });

  const userId = await getUserId(request, env);
  if (!userId) return new Response('Unauthorized', { status: 401 });

  const { id } = params;
  if (!id) return new Response('ID required', { status: 400 });

  // Verify the page belongs to the user
  const page = await env.DB.prepare(
    'SELECT id FROM status_pages WHERE id = ? AND user_id = ?'
  ).bind(id, userId).first();

  if (!page) {
    return new Response('Status page not found', { status: 404 });
  }

  await env.DB.prepare('DELETE FROM status_pages WHERE id = ? AND user_id = ?')
    .bind(id, userId).run();

  return new Response('Deleted successfully');
};