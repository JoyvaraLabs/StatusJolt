import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';

interface Env {
  DB: D1Database;
  JWT_SECRET: string;
}

interface SignupData {
  name: string;
  email: string;
  password: string;
  company?: string;
  plan: 'free' | 'pro';
}

export async function onRequestPost(context: { request: Request; env: Env }) {
  try {
    const { request, env } = context;
    const data: SignupData = await request.json();
    
    // Basic validation
    if (!data.name || !data.email || !data.password) {
      return new Response('Missing required fields', { status: 400 });
    }
    
    if (data.password.length < 8) {
      return new Response('Password must be at least 8 characters', { status: 400 });
    }
    
    // Check if user already exists
    const existingUser = await env.DB.prepare(
      'SELECT id FROM users WHERE email = ?'
    ).bind(data.email).first();
    
    if (existingUser) {
      return new Response('Email already registered', { status: 409 });
    }
    
    // Hash password
    const passwordHash = await bcrypt.hash(data.password, 10);
    
    // Generate user ID
    const userId = crypto.randomUUID().replace(/-/g, '');
    
    // Insert user
    await env.DB.prepare(`
      INSERT INTO users (id, name, email, password_hash, company, plan)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(userId, data.name, data.email, passwordHash, data.company || '', data.plan || 'free').run();
    
    // Create initial status page for the user
    const statusPageId = crypto.randomUUID().replace(/-/g, '');
    const subdomain = data.email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '').toLowerCase() + Math.random().toString(36).substring(2, 6);
    
    await env.DB.prepare(`
      INSERT INTO status_pages (id, user_id, name, subdomain, description)
      VALUES (?, ?, ?, ?, ?)
    `).bind(statusPageId, userId, `${data.company || 'My Company'} Status`, subdomain, `Status page for ${data.company || 'My Company'}`).run();
    
    // Create default components
    const components = [
      { name: 'Website', description: 'Main website', position: 1 },
      { name: 'API', description: 'API services', position: 2 },
      { name: 'Database', description: 'Database services', position: 3 }
    ];
    
    for (const component of components) {
      const componentId = crypto.randomUUID().replace(/-/g, '');
      await env.DB.prepare(`
        INSERT INTO components (id, status_page_id, name, description, position)
        VALUES (?, ?, ?, ?, ?)
      `).bind(componentId, statusPageId, component.name, component.description, component.position).run();
    }
    
    // Generate JWT
    const secret = new TextEncoder().encode(env.JWT_SECRET);
    const token = await new SignJWT({ userId, email: data.email })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(secret);
    
    // Create session
    const sessionId = crypto.randomUUID().replace(/-/g, '');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    
    await env.DB.prepare(`
      INSERT INTO sessions (id, user_id, expires_at)
      VALUES (?, ?, ?)
    `).bind(sessionId, userId, expiresAt.toISOString()).run();
    
    // Set cookie
    const response = new Response(JSON.stringify({ 
      success: true, 
      user: { 
        id: userId, 
        name: data.name, 
        email: data.email, 
        plan: data.plan 
      } 
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
    response.headers.set('Set-Cookie', `auth-token=${token}; HttpOnly; Secure; SameSite=Strict; Max-Age=604800; Path=/`);
    
    return response;
    
  } catch (error) {
    console.error('Signup error:', error);
    return new Response('Internal server error', { status: 500 });
  }
}