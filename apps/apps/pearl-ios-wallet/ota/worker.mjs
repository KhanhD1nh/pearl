const BASE = 'https://raw.githubusercontent.com/KhanhD1nh/pearl/ota-updates';

export default {
  async fetch(request) {
    if (request.method !== 'GET') return new Response('Method not allowed', { status: 405 });
    const platform = request.headers.get('expo-platform');
    const runtime = request.headers.get('expo-runtime-version');
    if (platform !== 'ios' || !runtime || !/^[a-zA-Z0-9._()-]+$/.test(runtime)) return new Response('Invalid runtime or platform', { status: 400 });
    const upstream = await fetch(`${BASE}/${encodeURIComponent(runtime)}/ios.json`, { cf: { cacheTtl: 0 } });
    if (upstream.status === 404) return new Response(null, { status: 204, headers: { 'expo-protocol-version': '1', 'expo-sfv-version': '0', 'cache-control': 'no-store' } });
    if (!upstream.ok) return new Response('Update unavailable', { status: 502 });
    const data = await upstream.json();
    if (typeof data.manifest !== 'string' || typeof data.signature !== 'string' || !/^[A-Za-z0-9+/=]+$/.test(data.signature)) return new Response('Invalid update', { status: 502 });
    return new Response(data.manifest, { headers: { 'content-type': 'application/json', 'expo-protocol-version': '1', 'expo-sfv-version': '0', 'expo-signature': `sig="${data.signature}", keyid="main", alg="rsa-v1_5-sha256"`, 'cache-control': 'no-store' } });
  },
};
