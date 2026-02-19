import type { APIRoute } from 'astro';

export const POST: APIRoute = async () => {
  const response = new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' }
  });
  response.headers.set('Set-Cookie', 'auth-token=; HttpOnly; Secure; SameSite=Strict; Max-Age=0; Path=/');
  return response;
};
