import { jwtVerify } from 'jose';

interface Env {
  DB: D1Database;
  JWT_SECRET: string;
}

interface User {
  id: string;
  email: string;
  name: string;
  plan: string;
}

declare global {
  namespace Cloudflare {
    interface RequestInit {
      user?: User;
    }
  }
}

export async function verifyAuth(request: Request, env: Env): Promise<User | null> {
  try {
    const authHeader = request.headers.get('Authorization');
    const cookieHeader = request.headers.get('Cookie');
    
    let token: string | null = null;
    
    // Check Authorization header
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
    // Check cookie
    else if (cookieHeader) {
      const cookies = cookieHeader.split(';');
      const authCookie = cookies.find(c => c.trim().startsWith('auth-token='));
      if (authCookie) {
        token = authCookie.split('=')[1];
      }
    }
    
    if (!token) {
      return null;
    }
    
    // Verify JWT
    const secret = new TextEncoder().encode(env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    
    const userId = payload.userId as string;
    
    // Get user from database
    const user = await env.DB.prepare(`
      SELECT id, name, email, plan 
      FROM users 
      WHERE id = ?
    `).bind(userId).first();
    
    if (!user) {
      return null;
    }
    
    return {
      id: user.id as string,
      name: user.name as string,
      email: user.email as string,
      plan: user.plan as string,
    };
    
  } catch (error) {
    console.error('Auth verification error:', error);
    return null;
  }
}

export async function onRequest(context: { request: Request; next: () => Promise<Response>; env: Env }) {
  const { request, next, env } = context;
  
  // Only apply auth to protected routes
  const url = new URL(request.url);
  const isProtectedRoute = url.pathname.startsWith('/dashboard') || 
                          url.pathname.startsWith('/api/status-pages') ||
                          url.pathname.startsWith('/api/components') ||
                          url.pathname.startsWith('/api/incidents');
  
  if (isProtectedRoute && request.method !== 'GET' && !url.pathname.includes('/public/')) {
    const user = await verifyAuth(request, env);
    
    if (!user) {
      return new Response('Unauthorized', { status: 401 });
    }
    
    // Add user to request context
    (request as any).user = user;
  }
  
  return next();
}