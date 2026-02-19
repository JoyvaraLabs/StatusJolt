import type { APIRoute } from 'astro';
import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';

interface LoginData {
  email: string;
  password: string;
}

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const env = locals.runtime?.env;
    if (!env?.DB) {
      return new Response('Database not available', { status: 500 });
    }

    const data: LoginData = await request.json();
    
    // Basic validation
    if (!data.email || !data.password) {
      return new Response('Missing email or password', { status: 400 });
    }
    
    // Find user
    const user = await env.DB.prepare(
      'SELECT id, name, email, password_hash, plan FROM users WHERE email = ?'
    ).bind(data.email).first();
    
    if (!user) {
      return new Response('Invalid email or password', { status: 401 });
    }
    
    // Verify password
    const isValid = await bcrypt.compare(data.password, user.password_hash as string);
    if (!isValid) {
      return new Response('Invalid email or password', { status: 401 });
    }
    
    // Generate JWT
    const jwtSecret = env.JWT_SECRET || 'fallback-jwt-secret';
    const secret = new TextEncoder().encode(jwtSecret);
    const token = await new SignJWT({ userId: user.id, email: user.email })
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
    `).bind(sessionId, user.id, expiresAt.toISOString()).run();
    
    // Create response
    const response = new Response(JSON.stringify({ 
      success: true, 
      user: { 
        id: user.id, 
        name: user.name, 
        email: user.email, 
        plan: user.plan 
      } 
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
    response.headers.set('Set-Cookie', `auth-token=${token}; HttpOnly; Secure; SameSite=Strict; Max-Age=604800; Path=/`);
    
    return response;
    
  } catch (error) {
    console.error('Login error:', error);
    return new Response('Internal server error', { status: 500 });
  }
};