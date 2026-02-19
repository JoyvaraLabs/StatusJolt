import { verifyAuth } from '../../_middleware';

interface Env {
  DB: D1Database;
  JWT_SECRET: string;
}

// GET /api/status-pages - List user's status pages
export async function onRequestGet(context: { request: Request; env: Env }) {
  try {
    const { request, env } = context;
    const user = await verifyAuth(request, env);
    
    if (!user) {
      return new Response('Unauthorized', { status: 401 });
    }
    
    const pages = await env.DB.prepare(`
      SELECT id, name, subdomain, custom_domain, description, is_public, created_at, updated_at
      FROM status_pages 
      WHERE user_id = ?
      ORDER BY created_at DESC
    `).bind(user.id).all();
    
    return new Response(JSON.stringify(pages.results), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Error fetching status pages:', error);
    return new Response('Internal server error', { status: 500 });
  }
}

// POST /api/status-pages - Create new status page
export async function onRequestPost(context: { request: Request; env: Env }) {
  try {
    const { request, env } = context;
    const user = await verifyAuth(request, env);
    
    if (!user) {
      return new Response('Unauthorized', { status: 401 });
    }
    
    const data = await request.json();
    
    // Validate input
    if (!data.name || !data.subdomain) {
      return new Response('Missing required fields', { status: 400 });
    }
    
    // Check subdomain availability
    const existingPage = await env.DB.prepare(
      'SELECT id FROM status_pages WHERE subdomain = ?'
    ).bind(data.subdomain).first();
    
    if (existingPage) {
      return new Response('Subdomain already taken', { status: 409 });
    }
    
    // Check plan limits
    const pageCount = await env.DB.prepare(
      'SELECT COUNT(*) as count FROM status_pages WHERE user_id = ?'
    ).bind(user.id).first();
    
    if (user.plan === 'free' && (pageCount?.count as number) >= 1) {
      return new Response('Free plan limited to 1 status page. Upgrade to Pro for unlimited pages.', { status: 403 });
    }
    
    // Create status page
    const pageId = crypto.randomUUID().replace(/-/g, '');
    
    const result = await env.DB.prepare(`
      INSERT INTO status_pages (id, user_id, name, subdomain, description)
      VALUES (?, ?, ?, ?, ?)
    `).bind(pageId, user.id, data.name, data.subdomain, data.description || '').run();
    
    if (!result.success) {
      throw new Error('Failed to create status page');
    }
    
    // Create default components
    const defaultComponents = [
      { name: 'Website', description: 'Main website', position: 1 },
      { name: 'API', description: 'API services', position: 2 },
      { name: 'Database', description: 'Database services', position: 3 }
    ];
    
    for (const component of defaultComponents) {
      const componentId = crypto.randomUUID().replace(/-/g, '');
      await env.DB.prepare(`
        INSERT INTO components (id, status_page_id, name, description, position)
        VALUES (?, ?, ?, ?, ?)
      `).bind(componentId, pageId, component.name, component.description, component.position).run();
    }
    
    // Return created page
    const createdPage = await env.DB.prepare(`
      SELECT id, name, subdomain, custom_domain, description, is_public, created_at, updated_at
      FROM status_pages 
      WHERE id = ?
    `).bind(pageId).first();
    
    return new Response(JSON.stringify(createdPage), {
      headers: { 'Content-Type': 'application/json' },
      status: 201
    });
    
  } catch (error) {
    console.error('Error creating status page:', error);
    return new Response('Internal server error', { status: 500 });
  }
}