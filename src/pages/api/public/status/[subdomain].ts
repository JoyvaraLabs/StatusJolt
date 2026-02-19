import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ params, locals }) => {
  const env = locals.runtime?.env;
  if (!env?.DB) return new Response('DB unavailable', { status: 500 });

  const { subdomain } = params;
  if (!subdomain) return new Response('Subdomain required', { status: 400 });

  // Get the status page by subdomain
  const page = await env.DB.prepare(
    `SELECT id, name, description, custom_domain, primary_color, is_public
     FROM status_pages WHERE subdomain = ? AND is_public = true`
  ).bind(subdomain).first();

  if (!page) {
    return new Response('Status page not found', { status: 404 });
  }

  // Get components for this status page
  const components = await env.DB.prepare(
    `SELECT id, name, description, status, position 
     FROM components WHERE status_page_id = ? ORDER BY position ASC, name ASC`
  ).bind(page.id).all();

  // Get recent incidents (last 30 days)
  const incidents = await env.DB.prepare(
    `SELECT id, title, description, status, impact, started_at, resolved_at, created_at
     FROM incidents 
     WHERE status_page_id = ? AND created_at >= datetime('now', '-30 days')
     ORDER BY created_at DESC`
  ).bind(page.id).all();

  // Get incident updates for the incidents
  const incidentIds = (incidents.results || []).map((incident: any) => incident.id);
  let incidentUpdates = [];
  
  if (incidentIds.length > 0) {
    const placeholders = incidentIds.map(() => '?').join(',');
    incidentUpdates = await env.DB.prepare(
      `SELECT incident_id, status, message, created_at
       FROM incident_updates 
       WHERE incident_id IN (${placeholders})
       ORDER BY created_at DESC`
    ).bind(...incidentIds).all();
  }

  // Group updates by incident ID
  const updatesByIncident: { [key: string]: any[] } = {};
  (incidentUpdates.results || []).forEach((update: any) => {
    if (!updatesByIncident[update.incident_id]) {
      updatesByIncident[update.incident_id] = [];
    }
    updatesByIncident[update.incident_id].push(update);
  });

  // Add updates to incidents
  const incidentsWithUpdates = (incidents.results || []).map((incident: any) => ({
    ...incident,
    updates: updatesByIncident[incident.id] || []
  }));

  return new Response(JSON.stringify({
    page: {
      id: page.id,
      name: page.name,
      description: page.description,
      primary_color: page.primary_color || '#3B82F6'
    },
    components: components.results || [],
    incidents: incidentsWithUpdates
  }), {
    headers: { 
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=60' // Cache for 1 minute
    }
  });
};