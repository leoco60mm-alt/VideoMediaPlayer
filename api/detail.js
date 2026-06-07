const DETAIL_HOST = 'https://netshort.dramafren.org';

function sendCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function isValidExternalId(id) {
  return /^\d{10,}$/.test(String(id || ''));
}

async function fetchDetail(url, extraHeaders) {
  return fetch(url, {
    method: 'GET',
    redirect: 'follow',
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
      ...extraHeaders,
    },
  });
}

export default async function handler(req, res) {
  sendCors(res);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const id = String(req.query.id || '').trim();
  if (!isValidExternalId(id)) {
    res.status(400).json({ error: 'Invalid id' });
    return;
  }

  const detailUrl = `${DETAIL_HOST}/index.php?page=detail&id=${encodeURIComponent(id)}`;
  const attempts = [
    {},
    { Referer: `${DETAIL_HOST}/`, Origin: DETAIL_HOST },
    { Referer: 'https://netshort.com/', Origin: 'https://netshort.com' },
  ];

  let lastStatus = 0;
  let lastBody = '';

  try {
    for (const headers of attempts) {
      const upstream = await fetchDetail(detailUrl, headers);
      const body = await upstream.text();
      lastStatus = upstream.status;
      lastBody = body;

      if (upstream.ok && body.includes('page=watch')) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        res.status(200).send(body);
        return;
      }
    }

    res.status(lastStatus || 502).json({
      error: 'Upstream fetch failed',
      status: lastStatus,
      detailUrl,
      snippet: lastBody.slice(0, 500),
    });
  } catch (err) {
    res.status(502).json({
      error: 'Proxy error',
      message: err && err.message ? err.message : String(err),
      detailUrl,
    });
  }
}
