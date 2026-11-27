const SITE_URL = 'https://pegatudo-vitrine.pages.dev';
const MAX_ACTIVE_OFFERS = 60;

function escapeXml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function isValidHttpUrl(url) {
  return typeof url === 'string' && /^https?:\/\//i.test(url.trim());
}

function isValidOffer(item) {
  if (!item || item.ativo === false) return false;
  if (!isValidHttpUrl(item.imagem)) return false;
  const precoPor = Number(item.precoPor || 0);
  const temCupom = Boolean(String(item.cupom || '').trim());
  return precoPor > 0 || temCupom;
}

function toIsoDate(raw, fallback) {
  const parsed = raw ? new Date(raw) : null;
  if (parsed && !Number.isNaN(parsed.getTime())) {
    return parsed.toISOString();
  }
  return fallback;
}

export async function onRequestGet(context) {
  const nowIso = new Date().toISOString();
  let lastModHome = nowIso;
  let validOffers = [];

  try {
    const assetUrl = new URL('/ofertas.json', context.request.url);
    const response = await context.env.ASSETS.fetch(assetUrl);
    if (response.ok) {
      const data = await response.json();
      lastModHome = toIsoDate(data?.config?.atualizadoEm, nowIso);
      const list = Array.isArray(data?.ofertas) ? data.ofertas : [];
      validOffers = list.filter(isValidOffer).slice(0, MAX_ACTIVE_OFFERS);
    }
  } catch (_) {
    // Fallback para sitemap básico da home caso ofertas.json falhe
  }

  const urls = [
    {
      loc: `${SITE_URL}/`,
      lastmod: lastModHome,
      changefreq: 'hourly',
      priority: '1.0',
    },
    ...validOffers
      .filter((item) => item.id)
      .map((item) => ({
        loc: `${SITE_URL}/?oferta=${encodeURIComponent(String(item.id))}`,
        lastmod: toIsoDate(item.adicionadoEm || item.criadoEm || item.dataCadastro || item.createdAt, lastModHome),
        changefreq: 'daily',
        priority: '0.8',
      })),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls
      .map(
        (entry) =>
          `  <url>\n` +
          `    <loc>${escapeXml(entry.loc)}</loc>\n` +
          `    <lastmod>${escapeXml(entry.lastmod)}</lastmod>\n` +
          `    <changefreq>${entry.changefreq}</changefreq>\n` +
          `    <priority>${entry.priority}</priority>\n` +
          `  </url>`
      )
      .join('\n') +
    `\n</urlset>\n`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=900',
    },
  });
}
