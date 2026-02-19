import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';

interface Env {
  DB: D1Database;
  JWT_SECRET: string;
}

interface LoginData {
  email: string;
  password: string;
}

export async function onRequestPost(context: { request: Request; env: Env }) {
  try {
    const { request, env } = context;
    const data: LoginData = await request.json();
    
    // Basic validation
    if (!data.email || !data.password) {
      return new Response('Missing email or password', { status: 400 });
    }
    
    // Get user from database
    const user = await env.DB.prepare(`
      SELECT id, name, email, password_hash, plan 
      FROM users 
      WHERE email = ?
    `).bind(data.email).first();
    
    if (!user) {
      return new Response('Invalid email or password', { status: 401 });
    }
    
    // Verify password
    const passwordValid = await bcrypt.compare(data.password, user.password_hash as string);
    
    if (!passwordValid) {
      return new Response('Invalid email or password', { status: 401 });
    }
    
    // Generate JWT
    const secret = new TextEncoder().encode(env.JWT_SECRET);
    const token = await new SignJWT({ 
      userId: user.id as string, 
      email: user.email as string 
    })
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
    
    // Clean up expired sessions
    await env.DB.prepare(`
      DELETE FROM sessions 
      WHERE expires_at < datetime('now')
    `).run();
    
    // Set cookie and return response
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
}