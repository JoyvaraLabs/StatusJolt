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

async function verifyIncidentOwnership(env: any, incidentId: string, userId: string): Promise<boolean> {
  const incident = await env.DB.prepare(
    `SELECT i.id FROM incidents i 
     JOIN status_pages sp ON i.status_page_id = sp.id 
     WHERE i.id = ? AND sp.user_id = ?`
  ).bind(incidentId, userId).first();
  return !!incident;
}

export const GET: APIRoute = async ({ params, request, locals }) => {
  const env = locals.runtime?.env;
  if (!env?.DB) return new Response('DB unavailable', { status: 500 });

  const userId = await getUserId(request, env);
  if (!userId) return new Response('Unauthorized', { status: 401 });

  const { id } = params;
  if (!id) return new Response('ID required', { status: 400 });

  const incident = await env.DB.prepare(
    `SELECT i.id, i.title, i.description, i.status, i.impact, i.started_at, i.resolved_at, 
            i.status_page_id, i.created_at, i.updated_at
     FROM incidents i 
     JOIN status_pages sp ON i.status_page_id = sp.id 
     WHERE i.id = ? AND sp.user_id = ?`
  ).bind(id, userId).first();

  if (!incident) {
    return new Response('Incident not found', { status: 404 });
  }

  return new Response(JSON.stringify(incident), {
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

  // Verify the incident belongs to the user
  if (!(await verifyIncidentOwnership(env, id, userId))) {
    return new Response('Incident not found', { status: 404 });
  }

  // Set resolved_at if status is resolved
  const resolvedAt = data.status === 'resolved' ? new Date().toISOString() : data.resolved_at;

  await env.DB.prepare(`
    UPDATE incidents 
    SET title = COALESCE(?, title),
        description = COALESCE(?, description),
        status = COALESCE(?, status),
        impact = COALESCE(?, impact),
        resolved_at = COALESCE(?, resolved_at),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(
    data.title,
    data.description,
    data.status,
    data.impact,
    resolvedAt,
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

  // Verify the incident belongs to the user
  if (!(await verifyIncidentOwnership(env, id, userId))) {
    return new Response('Incident not found', { status: 404 });
  }

  await env.DB.prepare('DELETE FROM incidents WHERE id = ?').bind(id).run();

  return new Response('Deleted successfully');
};