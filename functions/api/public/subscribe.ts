interface Env {
  DB: D1Database;
}

export async function onRequestPost(context: { request: Request; env: Env }) {
  try {
    const { request, env } = context;
    const data = await request.json();
    
    if (!data.statusPageId || !data.email) {
      return new Response('Missing required fields', { status: 400 });
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      return new Response('Invalid email format', { status: 400 });
    }
    
    // Check if status page exists and is public
    const statusPage = await env.DB.prepare(`
      SELECT id, name FROM status_pages 
      WHERE id = ? AND is_public = 1
    `).bind(data.statusPageId).first();
    
    if (!statusPage) {
      return new Response('Status page not found', { status: 404 });
    }
    
    // Check if already subscribed
    const existingSubscriber = await env.DB.prepare(`
      SELECT id FROM subscribers 
      WHERE status_page_id = ? AND email = ?
    `).bind(data.statusPageId, data.email).first();
    
    if (existingSubscriber) {
      return new Response('Email already subscribed', { status: 409 });
    }
    
    // Generate verification token
    const verificationToken = crypto.randomUUID().replace(/-/g, '');
    
    // Add subscriber
    const subscriberId = crypto.randomUUID().replace(/-/g, '');
    
    await env.DB.prepare(`
      INSERT INTO subscribers (id, status_page_id, email, verified, verification_token)
      VALUES (?, ?, ?, ?, ?)
    `).bind(subscriberId, data.statusPageId, data.email, false, verificationToken).run();
    
    // In a full implementation, you would send a verification email here
    // For now, we'll just auto-verify for demo purposes
    await env.DB.prepare(`
      UPDATE subscribers 
      SET verified = 1, verification_token = NULL 
      WHERE id = ?
    `).bind(subscriberId).run();
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Successfully subscribed to notifications'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Error subscribing:', error);
    return new Response('Internal server error', { status: 500 });
  }
}