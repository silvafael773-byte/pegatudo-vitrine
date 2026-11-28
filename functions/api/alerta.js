const N8N_LEAD_WEBHOOK = 'http://163-176-38-216.sslip.io:5678/webhook/pegatudo-alerta-lead';

function normalizeWhatsapp(raw) {
  let digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 10 || digits.length === 11) {
    digits = '55' + digits;
  }
  return digits;
}

export async function onRequestPost(context) {
  try {
    const body = await context.request.json().catch(() => ({}));
    const palavraChave = String(body.palavraChave || body.produto || '').trim();
    const whatsapp = normalizeWhatsapp(body.whatsapp);
    const precoDesejadoNum = Number(body.precoDesejado || 0);
    const precoDesejado = Number.isFinite(precoDesejadoNum) && precoDesejadoNum > 0 ? precoDesejadoNum : null;

    if (palavraChave.length < 2) {
      return new Response(
        JSON.stringify({ ok: false, message: 'Informe o produto desejado (mínimo 2 letras).' }),
        { status: 400, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
      );
    }

    if (whatsapp.length < 12 || whatsapp.length > 13) {
      return new Response(
        JSON.stringify({ ok: false, message: 'Informe um WhatsApp válido com DDD (ex: 12 98801-5828).' }),
        { status: 400, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
      );
    }

    const upstream = await fetch(N8N_LEAD_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        palavraChave,
        whatsapp,
        ...(precoDesejado !== null ? { precoDesejado } : {}),
      }),
    });
    const text = await upstream.text();
    let parsed = null;
    try { parsed = JSON.parse(text); } catch (_) {}

    if (!parsed) {
      return new Response(
        JSON.stringify({
          ok: upstream.ok,
          message: upstream.ok ? 'Alerta ativado! Confira seu WhatsApp.' : `Erro no servidor de alertas (HTTP ${upstream.status}).`,
        }),
        { status: upstream.ok ? 200 : 502, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
      );
    }

    return new Response(JSON.stringify(parsed), {
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
