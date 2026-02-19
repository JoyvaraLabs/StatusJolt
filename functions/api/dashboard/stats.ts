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
    
    // Get status pages count
    const pagesResult = await env.DB.prepare(`
      SELECT COUNT(*) as count FROM status_pages WHERE user_id = ?
    `).bind(user.id).first();
    
    // Get components count
    const componentsResult = await env.DB.prepare(`
      SELECT COUNT(*) as count 
      FROM components c 
      JOIN status_pages sp ON c.status_page_id = sp.id 
      WHERE sp.user_id = ?
    `).bind(user.id).first();
    
    // Get active incidents count
    const incidentsResult = await env.DB.prepare(`
      SELECT COUNT(*) as count 
      FROM incidents i 
      JOIN status_pages sp ON i.status_page_id = sp.id 
      WHERE sp.user_id = ? AND i.status != 'resolved'
    `).bind(user.id).first();
    
    // Get subscribers count
    const subscribersResult = await env.DB.prepare(`
      SELECT COUNT(*) as count 
      FROM subscribers s 
      JOIN status_pages sp ON s.status_page_id = sp.id 
      WHERE sp.user_id = ?
    `).bind(user.id).first();
    
    const stats = {
      pages: pagesResult?.count || 0,
      components: componentsResult?.count || 0,
      activeIncidents: incidentsResult?.count || 0,
      subscribers: subscribersResult?.count || 0,
    };
    
    return new Response(JSON.stringify(stats), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return new Response('Internal server error', { status: 500 });
  }
}