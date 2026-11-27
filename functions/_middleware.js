const SITE_URL = 'https://pegatudo-vitrine.pages.dev';

const brlFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

class TitleRewriter {
  constructor(title) {
    this.title = title;
  }
  element(element) {
    element.setInnerContent(this.title);
  }
}

class AttrRewriter {
  constructor(attr, value) {
    this.attr = attr;
    this.value = value;
  }
  element(element) {
    element.setAttribute(this.attr, this.value);
  }
}

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const ofertaId = url.searchParams.get('oferta');

  if (!ofertaId || (url.pathname !== '/' && url.pathname !== '/index.html')) {
    return context.next();
  }

  const response = await context.next();
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) {
    return response;
  }

  let oferta = null;
  try {
    const assetUrl = new URL('/ofertas.json', context.request.url);
    const dataResp = await context.env.ASSETS.fetch(assetUrl);
    if (dataResp.ok) {
      const data = await dataResp.json();
      const lista = Array.isArray(data?.ofertas) ? data.ofertas : [];
      oferta = lista.find((o) => o && String(o.id) === String(ofertaId) && o.ativo !== false) || null;
    }
  } catch (_) {
    return response;
  }

  if (!oferta) {
    return response;
  }

  const loja = String(oferta.loja || 'PegaTudo Ofertas').toUpperCase();
  const precoPor = Number(oferta.precoPor || 0);
  const precoDe = Number(oferta.precoDe || 0);
  const precoTxt = precoPor > 0 ? ` por ${brlFormatter.format(precoPor)}` : '';
  const desconto = precoDe > precoPor && precoPor > 0 ? Math.round(((precoDe - precoPor) / precoDe) * 100) : 0;
  const descTxt = desconto > 0 ? ` (-${desconto}% OFF)` : '';
  const cupomTxt = oferta.cupom ? ` | Cupom: ${oferta.cupom}` : '';

  const title = `${oferta.titulo}${precoTxt}${descTxt} — PegaTudo Ofertas`;
  const description = `Oferta na loja ${loja}${precoTxt}${descTxt}${cupomTxt}. Garimpada pelo PegaTudo Ofertas.`;
  const pageUrl = `${SITE_URL}/?oferta=${encodeURIComponent(String(oferta.id))}`;
  const image = oferta.imagem || `${SITE_URL}/assets/logo-pegatudo.png`;

  return new HTMLRewriter()
    .on('title', new TitleRewriter(title))
    .on('meta#meta-description', new AttrRewriter('content', description))
    .on('link#canonical-link', new AttrRewriter('href', pageUrl))
    .on('meta#og-title', new AttrRewriter('content', title))
    .on('meta#og-description', new AttrRewriter('content', description))
    .on('meta#og-url', new AttrRewriter('content', pageUrl))
    .on('meta#og-image', new AttrRewriter('content', image))
    .on('meta#twitter-title', new AttrRewriter('content', title))
    .on('meta#twitter-description', new AttrRewriter('content', description))
    .on('meta#twitter-image', new AttrRewriter('content', image))
    .transform(response);
}
