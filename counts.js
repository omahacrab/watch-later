// Read only playlist header/sidebar metadata, never loaded row counts or views.
export function extractPlaylistTotal(data, pageText = '') {
  const exactNumber = text => {
    const value = String(text ?? '').trim();
    if (!/^[0-9]+(?:[, .\u00a0\u202f][0-9]{3})*$/.test(value)) return null;
    return Number(value.replace(/[^0-9]/g, ''));
  };
  const joined = value => typeof value === 'string' ? value : value?.simpleText || (value?.runs || []).map(r => r.text || '').join('') || value?.content || '';
  const labeled = text => {
    const match = String(text).match(/(?:^|[^\d.,])([0-9]+(?:[, .\u00a0\u202f][0-9]{3})*)\s+(?:videos?|vidéos?|vídeos?)(?=$|[^\p{L}])/iu);
    return match ? exactNumber(match[1]) : null;
  };
  let total = null;
  function metadata(value) {
    if (total !== null || !value) return;
    if (typeof value === 'string') { total = labeled(value); return; }
    if (typeof value !== 'object') return;
    total = labeled(joined(value));
    if (total !== null) return;
    for (const [key, child] of Object.entries(value)) {
      if (!['title','description','accessibility','accessibilityData','trackingParams','clickTrackingParams'].includes(key)) metadata(child);
    }
  }
  function find(value) {
    if (!value || typeof value !== 'object' || total !== null) return;
    const h = value.playlistHeaderRenderer;
    if (h?.numVideosText) total = labeled(joined(h.numVideosText)) ?? exactNumber(joined(h.numVideosText));
    const sidebar = value.playlistSidebarPrimaryInfoRenderer;
    if (total === null && sidebar?.stats?.[0]) total = labeled(joined(sidebar.stats[0])) ?? exactNumber(joined(sidebar.stats[0]));
    for (const key of ['pageHeaderViewModel','pageHeaderRenderer','playlistHeaderViewModel']) {
      const header = value[key];
      if (header) { metadata(header.metadata); metadata(header.content); metadata(header.subtitle); }
    }
    for (const [key, child] of Object.entries(value)) {
      if (!['contents','playlistVideoRenderer','videoRenderer','compactVideoRenderer'].includes(key)) find(child);
      else if (key === 'contents' && !value.playlistVideoRenderer) {
        // Header may be under a browse contents wrapper; row titles remain excluded.
        if (typeof child === 'object') find(child);
      }
    }
  }
  find(data);
  return total ?? labeled(pageText);
}
export function capacity(total, limit = 5000) {
  if (!Number.isInteger(total) || total < 0) return null;
  return {total, free: Math.max(0,limit-total), percent: Math.min(100,total/limit*100)};
}
