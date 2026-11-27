const N8N_CLICK_WEBHOOK = 'http://163-176-38-216.sslip.io:5678/webhook/pegatudo-click';
const FALLBACK_URL = 'https://pegatudo-vitrine.pages.dev/';

function isValidHttpUrl(url) {
  return typeof url === 'string' && /^https?:\/\//i.test(url.trim());
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const ofertaId = (url.searchParams.get('id') || '').trim();
  const origem = (url.searchParams.get('src') || 'grade').trim();

  if (!ofertaId) {
    return Response.redirect(FALLBACK_URL, 302);
  }

  let oferta = null;
  try {
    const assetUrl = new URL('/ofertas.json', context.request.url);
    const dataResp = await context.env.ASSETS.fetch(assetUrl);
    if (dataResp.ok) {
      const data = await dataResp.json();
      const lista = Array.isArray(data?.ofertas) ? data.ofertas : [];
      oferta = lista.find((o) => o && String(o.id) === ofertaId) || null;
    }
  } catch (_) {}

  const targetUrl = oferta && isValidHttpUrl(oferta.linkAfiliado)
    ? oferta.linkAfiliado.trim()
    : `${FALLBACK_URL}?oferta=${encodeURIComponent(ofertaId)}`;

  const payload = {
    id: ofertaId,
    loja: String(oferta?.loja || 'DESCONHECIDA'),
    categoria: String(oferta?.categoria || 'OUTROS'),
    origem,
  };

  if (typeof context.waitUntil === 'function') {
    context.waitUntil(
      fetch(N8N_CLICK_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch(() => {})
    );
  }

  return Response.redirect(targetUrl, 302);
}
