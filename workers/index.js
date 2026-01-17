/**
 * SwarmBlitz Cloudflare Worker Entry Point
 * 
 * Routes requests to Room Durable Objects
 */

export { Room } from './room.js';

/**
 * Main worker fetch handler
 */
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Playlist endpoint (used by client SoundManager)
    // In Workers we can't reliably enumerate static assets at runtime, so keep this list explicit.
    if (url.pathname === '/api/playlist') {
      const tracks = [
        'SwarmBlitz - Arcade Pulse Loop.mp3',
        'SwarmBlitz - Stealth Loop.mp3',
        'SwarmBlitz Game Loop (1).mp3',
      ];
      return new Response(JSON.stringify({ tracks }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          // Cache lightly (clients can retry if missing)
          'Cache-Control': 'public, max-age=300',
        },
      });
    }
    
    // Route to room
    if (url.pathname.startsWith('/room/')) {
      const parts = url.pathname.split('/');
      const roomId = parts[2] || 'default';
      
      // Get or create Room Durable Object
      const id = env.ROOM.idFromName(roomId);
      const room = env.ROOM.get(id);

      // WebSocket upgrades are sensitive: avoid rewriting the URL/body for upgrade requests.
      // Forward the original upgrade request untouched (no header mutation / cloning).
      // The DO can infer room name from the URL path (`/room/<name>`).
      if (request.headers.get('Upgrade') === 'websocket') {
        return room.fetch(request);
      }

      // Rewrite path so the DO sees clean routes like `/status` instead of `/room/<id>/status`.
      const rest = parts.slice(3).join('/');
      const rewrittenUrl = new URL(request.url);
      rewrittenUrl.pathname = '/' + rest; // rest may be empty -> "/"
      if (rewrittenUrl.pathname === '//') rewrittenUrl.pathname = '/';

      // Keep the room name via a header so the DO can gate loadtest-only behavior on HTTP endpoints.
      const headers = new Headers(request.headers);
      headers.set('X-Room-Name', roomId);

      return room.fetch(new Request(rewrittenUrl.toString(), {
        method: request.method,
        headers,
        // Only include a body for non-GET/HEAD methods.
        body: (request.method === 'GET' || request.method === 'HEAD') ? undefined : request.body,
        redirect: request.redirect,
      }));
    }
    
    // Health check
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // List rooms (for debugging)
    if (url.pathname === '/rooms') {
      // Note: Durable Objects don't have a built-in list API
      // This would need external tracking (KV, D1, etc.)
      return new Response(JSON.stringify({ rooms: ['default'] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Serve static files (if configured)
    // In production, use Cloudflare Pages or R2 for static assets
    
    return new Response('SwarmBlitz API', {
      headers: corsHeaders,
    });
  },
};

