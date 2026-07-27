export default {
  async fetch(request, env) {
    // ponytail: reads only request.method — no IP, no body, no headers stored (D-02, T-13-01-IP)
    if (request.method !== 'POST') return new Response(null, { status: 204 });

    // ponytail: KV is eventually consistent — concurrent increments can be lost; counter is approximate
    const today = new Date().toISOString().slice(0, 10);
    const rawTotal = await env.INSTALLS.get('total');
    const total = parseInt(rawTotal ?? '0', 10);
    const safeTotal = Number.isNaN(total) ? 0 : total;
    await env.INSTALLS.put('total', String(safeTotal + 1));
    const rawDay = await env.INSTALLS.get(today);
    const day = parseInt(rawDay ?? '0', 10);
    const safeDay = Number.isNaN(day) ? 0 : day;
    await env.INSTALLS.put(today, String(safeDay + 1));

    return new Response(null, { status: 200 });
  },
};
