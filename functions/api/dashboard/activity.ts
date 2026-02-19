import { verifyAuth } from '../../_middleware';

interface Env {
  DB: D1Database;
  JWT_SECRET: string;
}

export async function onRequestGet(context: { request: Request; env: Env }) {
  try {
    const { request, env } = context;
    const user = await verifyAuth(request, env);
    
    if (!user) {
      return new Response('Unauthorized', { status: 401 });
    }
    
    // Get recent activity (incidents, components changes, etc.)
    const activity = [];
    
    // Recent incidents
    const incidents = await env.DB.prepare(`
      SELECT i.id, i.title, i.status, i.impact, i.created_at, 'incident' as type,
             sp.name as page_name
      FROM incidents i 
      JOIN status_pages sp ON i.status_page_id = sp.id 
      WHERE sp.user_id = ?
      ORDER BY i.created_at DESC
      LIMIT 10
    `).bind(user.id).all();
    
    for (const incident of incidents.results) {
      activity.push({
        type: 'incident',
        message: `${incident.impact} incident "${incident.title}" ${incident.status} on ${incident.page_name}`,
        created_at: incident.created_at,
        data: incident
      });
    }
    
    // Recent status pages created
    const pages = await env.DB.prepare(`
      SELECT id, name, created_at
      FROM status_pages 
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 5
    `).bind(user.id).all();
    
    for (const page of pages.results) {
      activity.push({
        type: 'page',
        message: `Status page "${page.name}" was created`,
        created_at: page.created_at,
        data: page
      });
    }
    
    // Sort all activity by date
    activity.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
    return new Response(JSON.stringify(activity.slice(0, 20)), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Error fetching activity:', error);
    return new Response('Internal server error', { status: 500 });
  }
}