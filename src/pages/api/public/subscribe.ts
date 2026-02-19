import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime?.env;
  if (!env?.DB) return new Response('DB unavailable', { status: 500 });

  const data = await request.json();
  if (!data.email || !data.status_page_id) {
    return new Response('Email and status_page_id required', { status: 400 });
  }

  // Verify the status page exists and is public
  const page = await env.DB.prepare(
    'SELECT id FROM status_pages WHERE id = ? AND is_public = true'
  ).bind(data.status_page_id).first();

  if (!page) {
    return new Response('Status page not found', { status: 404 });
  }

  // Check if already subscribed
  const existing = await env.DB.prepare(
    'SELECT id FROM subscribers WHERE status_page_id = ? AND email = ?'
  ).bind(data.status_page_id, data.email).first();

  if (existing) {
    return new Response('Already subscribed', { status: 409 });
  }

  // Add subscriber
  const id = crypto.randomUUID().replace(/-/g, '');
  await env.DB.prepare(`
    INSERT INTO subscribers (id, status_page_id, email, verified)
    VALUES (?, ?, ?, ?)
  `).bind(id, data.status_page_id, data.email, true).run();

  return new Response(JSON.stringify({ 
    message: 'Successfully subscribed to updates'
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
};