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
    
    return new Response(JSON.stringify({ user }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Error fetching user:', error);
    return new Response('Unauthorized', { status: 401 });
  }
}