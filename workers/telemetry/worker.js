export default {
  async fetch(request, env) {
    // ponytail: reads only request.method — no IP, no body, no headers stored (D-02, T-13-01-IP)
    if (request.method !== 'POST') return new Response(null, { status: 204 });

    const today = new Date().toISOString().slice(0, 10);
    const total = parseInt((await env.INSTALLS.get('total')) ?? '0', 10);
    await env.INSTALLS.put('total', String(total + 1));
    const day = parseInt((await env.INSTALLS.get(today)) ?? '0', 10);
    await env.INSTALLS.put(today, String(day + 1));

    return new Response(null, { status: 200 });
  },
};
