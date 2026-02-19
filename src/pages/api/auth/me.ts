import type { APIRoute } from 'astro';
import { jwtVerify } from 'jose';

export const GET: APIRoute = async ({ request, locals }) => {
  try {
    const env = locals.runtime?.env;
    if (!env?.DB) {
      return new Response('Database not available', { status: 500 });
    }

    const cookie = request.headers.get('cookie') || '';
    const tokenMatch = cookie.match(/auth-token=([^;]+)/);
    if (!tokenMatch) {
      return new Response('Not authenticated', { status: 401 });
    }

    const token = tokenMatch[1];
    const jwtSecret = env.JWT_SECRET || 'fallback-jwt-secret';
    const secret = new TextEncoder().encode(jwtSecret);

    const { payload } = await jwtVerify(token, secret);
    const userId = payload.userId as string;

    const user = await env.DB.prepare(
      'SELECT id, name, email, company, plan FROM users WHERE id = ?'
    ).bind(userId).first();

    if (!user) {
      return new Response('User not found', { status: 401 });
    }

    return new Response(JSON.stringify({ user }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Auth check error:', error);
    return new Response('Not authenticated', { status: 401 });
  }
};
