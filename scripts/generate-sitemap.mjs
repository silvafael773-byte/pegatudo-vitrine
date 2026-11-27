import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT_DIR = process.cwd();
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

function validateStorefrontHtml() {
  const htmlPath = path.join(ROOT_DIR, 'index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');
  const scriptMatches = [...html.matchAll(/<script(?:\s+[^>]*)?>([\s\S]*?)<\/script>/gi)];

  const inlineScripts = scriptMatches
    .filter((match) => !/\bsrc\s*=|\btype\s*=\s*["']application\/ld\+json["']/i.test(match[0]))
    .map((match) => match[1].trim())
    .filter(Boolean);

  if (inlineScripts.length === 0) {
    throw new Error('Nenhum script inline principal encontrado em index.html');
  }

  for (let i = 0; i < inlineScripts.length; i++) {
    new vm.Script(inlineScripts[i], { filename: `index-inline-${i + 1}.js` });
  }
}

function validateRobots() {
  const robotsPath = path.join(ROOT_DIR, 'robots.txt');
  const robots = fs.readFileSync(robotsPath, 'utf8');
  if (!robots.includes(`Sitemap: ${SITE_URL}/sitemap.xml`)) {
    throw new Error('robots.txt não contém a diretiva Sitemap esperada');
  }
}

function buildSitemap() {
  const ofertasPath = path.join(ROOT_DIR, 'ofertas.json');
  const raw = fs.readFileSync(ofertasPath, 'utf8');
  const data = JSON.parse(raw);

  if (!data || !Array.isArray(data.ofertas)) {
    throw new Error('ofertas.json inválido: campo "ofertas" deve ser um array');
  }

  const nowIso = new Date().toISOString();
  const lastModHome = toIsoDate(data?.config?.atualizadoEm, nowIso);
  const validOffers = data.ofertas.filter(isValidOffer).slice(0, MAX_ACTIVE_OFFERS);

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

  const sitemapPath = path.join(ROOT_DIR, 'sitemap.xml');
  fs.writeFileSync(sitemapPath, xml, 'utf8');

  return {
    totalRaw: data.ofertas.length,
    totalValidUrls: urls.length - 1,
    sitemapPath,
  };
}

validateStorefrontHtml();
validateRobots();
const result = buildSitemap();
console.log(
  `[build] index.html OK | robots.txt OK | sitemap.xml gerado (${result.totalValidUrls} ofertas válidas de ${result.totalRaw} totais)`
);
