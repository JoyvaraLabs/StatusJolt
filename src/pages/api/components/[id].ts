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

async function verifyComponentOwnership(env: any, componentId: string, userId: string): Promise<boolean> {
  const component = await env.DB.prepare(
    `SELECT c.id FROM components c 
     JOIN status_pages sp ON c.status_page_id = sp.id 
     WHERE c.id = ? AND sp.user_id = ?`
  ).bind(componentId, userId).first();
  return !!component;
}

export const GET: APIRoute = async ({ params, request, locals }) => {
  const env = locals.runtime?.env;
  if (!env?.DB) return new Response('DB unavailable', { status: 500 });

  const userId = await getUserId(request, env);
  if (!userId) return new Response('Unauthorized', { status: 401 });

  const { id } = params;
  if (!id) return new Response('ID required', { status: 400 });

  const component = await env.DB.prepare(
    `SELECT c.id, c.name, c.description, c.status, c.position, c.status_page_id, c.created_at, c.updated_at
     FROM components c 
     JOIN status_pages sp ON c.status_page_id = sp.id 
     WHERE c.id = ? AND sp.user_id = ?`
  ).bind(id, userId).first();

  if (!component) {
    return new Response('Component not found', { status: 404 });
  }

  return new Response(JSON.stringify(component), {
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

  // Verify the component belongs to the user
  if (!(await verifyComponentOwnership(env, id, userId))) {
    return new Response('Component not found', { status: 404 });
  }

  await env.DB.prepare(`
    UPDATE components 
    SET name = COALESCE(?, name),
        description = COALESCE(?, description),
        status = COALESCE(?, status),
        position = COALESCE(?, position),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(
    data.name,
    data.description,
    data.status,
    data.position,
    id
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

  // Verify the component belongs to the user
  if (!(await verifyComponentOwnership(env, id, userId))) {
    return new Response('Component not found', { status: 404 });
  }

  await env.DB.prepare('DELETE FROM components WHERE id = ?').bind(id).run();

  return new Response('Deleted successfully');
};