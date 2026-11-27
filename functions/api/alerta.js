const N8N_LEAD_WEBHOOK = 'http://163.176.38.216:5678/webhook/pegatudo-alerta-lead';

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const upstream = await fetch(N8N_LEAD_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, message: 'Erro ao conectar com o servidor de alertas.' }),
      { status: 502, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  }
}
