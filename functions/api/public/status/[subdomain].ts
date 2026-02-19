interface Env {
  DB: D1Database;
}

export async function onRequestGet(context: { request: Request; env: Env; params: { subdomain: string } }) {
  try {
    const { env, params } = context;
    const { subdomain } = params;
    
    // Get status page by subdomain
    const page = await env.DB.prepare(`
      SELECT id, name, subdomain, custom_domain, description, logo_url, primary_color, is_public
      FROM status_pages 
      WHERE subdomain = ? AND is_public = 1
    `).bind(subdomain).first();
    
    if (!page) {
      return new Response('Status page not found', { status: 404 });
    }
    
    // Get components for this status page
    const components = await env.DB.prepare(`
      SELECT id, name, description, status, position
      FROM components 
      WHERE status_page_id = ?
      ORDER BY position ASC, name ASC
    `).bind(page.id).all();
    
    // Get recent incidents (last 30 days)
    const incidents = await env.DB.prepare(`
      SELECT id, title, description, status, impact, started_at, resolved_at, created_at, updated_at
      FROM incidents 
      WHERE status_page_id = ? 
      AND created_at > datetime('now', '-30 days')
      ORDER BY created_at DESC
    `).bind(page.id).all();
    
    // Get incident updates for recent incidents
    const incidentUpdates = [];
    if (incidents.results.length > 0) {
      const incidentIds = incidents.results.map(i => `'${i.id}'`).join(',');
      const updates = await env.DB.prepare(`
        SELECT incident_id, status, message, created_at
        FROM incident_updates 
        WHERE incident_id IN (${incidentIds})
        ORDER BY created_at DESC
      `).all();
      
      incidentUpdates.push(...updates.results);
    }
    
    // Group updates by incident
    const incidentsWithUpdates = incidents.results.map(incident => ({
      ...incident,
      updates: incidentUpdates.filter(update => update.incident_id === incident.id)
    }));
    
    const response = {
      page: {
        id: page.id,
        name: page.name,
        subdomain: page.subdomain,
        custom_domain: page.custom_domain,
        description: page.description,
        logo_url: page.logo_url,
        primary_color: page.primary_color
      },
      components: components.results,
      incidents: incidentsWithUpdates
    };
    
    return new Response(JSON.stringify(response), {
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60' // Cache for 1 minute
      }
    });
    
  } catch (error) {
    console.error('Error fetching public status page:', error);
    return new Response('Internal server error', { status: 500 });
  }
}