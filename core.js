import {unavailableVideo} from './list-options.js';
import {watchProgress} from './search-pills.js';
import {extractChannels} from './channels.js';
export const BATCH_SIZE = 500;
export const textOf = v => v?.simpleText || (v?.runs || []).map(r => r.text || '').join('');

// Scope entries and continuation commands to playlist lists, never recommendations.
export function parsePlaylist(data, firstPage = false) {
  const containers = [], errors = [], totals = [];
  const numberOf = value => {
    const text = typeof value === 'number' ? String(value) : typeof value === 'string' ? value : textOf(value);
    if (!text || /[0-9][.,][0-9]+\s*[KMB]/i.test(text)) return null;
    const match = text.match(/[0-9][0-9, .\u00a0]*/);
    return match ? Number(match[0].replace(/[^0-9]/g, '')) : null;
  };
  function find(obj) {
    if (!obj || typeof obj !== 'object') return;
    if (obj.alertRenderer?.type === 'ERROR') errors.push(textOf(obj.alertRenderer.text));
    for (const key of ['playlistVideoListRenderer', 'playlistVideoListContinuation']) {
      if (obj[key]) containers.push({entries: obj[key].contents || [], metadata: obj[key].continuations || [], target: obj[key].targetId});
    }
    for (const key of ['appendContinuationItemsAction', 'reloadContinuationItemsCommand']) {
      if (obj[key]) containers.push({entries: obj[key].continuationItems || [], metadata: obj[key].continuations || [], target: obj[key].targetId});
    }
    const header = obj.playlistHeaderRenderer;
    if (header?.numVideosText) totals.push(numberOf(header.numVideosText));
    if (obj.playlistSidebarPrimaryInfoRenderer?.stats?.[0]) totals.push(numberOf(obj.playlistSidebarPrimaryInfoRenderer.stats[0]));
    for (const value of Object.values(obj)) find(value);
  }
  find(data);
  if (errors.length) throw new Error(errors.join(' '));
  if (!containers.length) throw new Error('YouTube returned an unfamiliar playlist format. Nothing removed.');
  const videos = [], tokens = new Set();
  let placeholders = 0, markers = 0;
  function continuation(obj) {
    if (!obj || typeof obj !== 'object') return;
    if (typeof obj.continuationCommand?.token === 'string') tokens.add(obj.continuationCommand.token);
    if (typeof obj.nextContinuationData?.continuation === 'string') tokens.add(obj.nextContinuationData.continuation);
    for (const value of Object.values(obj)) continuation(value);
  }
  for (const container of containers) {
    // Response actions may also contain recommendations. Ignore those containers.
    if (!container.entries.some(e => e.playlistVideoRenderer) && container.target && !/playlist/i.test(container.target)) continue;
    continuation(container.metadata);
    markers += container.metadata.length;
    for (const entry of container.entries) {
      const v = entry.playlistVideoRenderer;
      if (v) {
        if (!v.setVideoId) placeholders++;
        videos.push({
          key: v.setVideoId || `unavailable:${v.videoId || ''}:${textOf(v.index)}:${textOf(v.title)}`,
          setVideoId: v.setVideoId || '', videoId: v.videoId || '',
          title: textOf(v.title) || 'Unavailable video', channel: textOf(v.shortBylineText), channels: extractChannels(v),
          watchedPercent: watchProgress(v), duration: textOf(v.lengthText), unavailable: unavailableVideo(v)
        });
      }
      if (entry.continuationItemRenderer) {
        markers++;
        // Includes buttonRenderer.command and commandExecutorCommand wrappers.
        continuation(entry.continuationItemRenderer);
      }
    }
  }
  if (tokens.size > 1) throw new Error('Multiple playlist continuations found. Scan stopped.');
  if (!firstPage && !videos.length && tokens.size) throw new Error('Next page had no playlist entries.');
  const expectedTotal = totals.find(n => n !== null) ?? null;
  const token = [...tokens][0] || null;
  const suspiciousEnd = !token && (markers > 0 || (firstPage && videos.length >= 100 && (expectedTotal === null || expectedTotal > videos.length)));
  // Diagnostics contain structure only, never request context, tokens or session data.
  const paths = [];
  function shape(obj, path = '', depth = 0) {
    if (!obj || typeof obj !== 'object' || depth > 25 || paths.length >= 60) return;
    for (const [key, value] of Object.entries(obj)) {
      if (['context', 'responseContext', 'trackingParams', 'clickTrackingParams'].includes(key)) continue;
      const next = `${path}/${key}`;
      if (/continuation/i.test(key)) paths.push(next.replace(/\/\d+(?=\/|$)/g, '/*'));
      shape(value, next, depth + 1);
    }
  }
  if (suspiciousEnd) shape(data);
  return {videos, token, placeholders, expectedTotal, suspiciousEnd,
    diagnostic: {entries: videos.length, markers, tokenFound: !!token, expectedTotal, continuationPaths: [...new Set(paths)]}};
}

export function mergeEntries(previous, incoming) {
  return [...new Map([...previous, ...incoming].map(v => [v.key, v])).values()];
}
const normalizeSearch = value => value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
export function parseSearch(query) {
  const source = query.replace(/[“”]/g, '"');
  const groups = [[]];
  let index = 0;
  while (index < source.length) {
    while (/\s/.test(source[index] || '') && index < source.length) index++;
    if (index >= source.length) break;
    const operator = source.slice(index).match(/^(OR|AND|\|)(?=\s|$)/);
    if (operator) {
      if (!groups.at(-1).length) return {groups: [], error: 'Add a search term before the operator.'};
      if (operator[1] !== 'AND') groups.push([]);
      index += operator[0].length;
      if (!source.slice(index).trim()) return {groups: [], error: 'Add a search term after the operator.'};
      continue;
    }
    const exclude = source[index] === '-';
    if (exclude) index++;
    const fieldMatch = source.slice(index).match(/^(title|channel):/i);
    const field = fieldMatch ? fieldMatch[1].toLowerCase() : null;
    if (fieldMatch) index += fieldMatch[0].length;
    let value, phrase = false;
    if (source[index] === '"') {
      phrase = true; const end = source.indexOf('"', index + 1);
      if (end < 0) return {groups: [], error: 'Close the quotation mark to search for an exact phrase.'};
      value = source.slice(index + 1, end); index = end + 1;
      if (index < source.length && !/\s/.test(source[index])) return {groups: [], error: 'Add a space after the quoted phrase.'};
    } else {
      const match = source.slice(index).match(/^\S+/);
      value = match?.[0] || ''; index += value.length;
      if (value.includes('"')) return {groups: [], error: 'Put quotation marks around the whole phrase.'};
    }
    value = normalizeSearch(value);
    if (!value) return {groups: [], error: 'Add a term after the field or minus sign; quoted phrases cannot be empty.'};
    let pattern = null;
    if (phrase) {
      const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Boundaries keep "race" out of "disgrace"; punctuation remains literal.
      pattern = new RegExp(`(?:^|[^\\p{L}\\p{N}_])${escaped}(?=$|[^\\p{L}\\p{N}_])`, 'u');
    }
    groups.at(-1).push({value, field, exclude, pattern});
  }
  return {groups, error: null};
}
export function filterEntries(videos, query, field = 'both', unavailableOnly = false) {
  const parsed = parseSearch(query);
  if (parsed.error) return [];
  return videos.filter(v => {
    if (unavailableOnly && !v.unavailable) return false;
    const fields = {title: normalizeSearch(v.title), channel: normalizeSearch(v.channel)};
    return parsed.groups.some(group => group.every(term => {
      const scope = term.field || field;
      const values = scope === 'both' ? [fields.title, fields.channel] : [fields[scope]];
      const found = values.some(value => term.pattern ? term.pattern.test(value) : value.includes(term.value));
      return term.exclude ? !found : found;
    }));
  });
}

export function batches(videos) {
  if (videos.some(v => !v.setVideoId)) throw new Error('Selection contains an entry without a removal ID.');
  const unique = [...new Map(videos.map(v => [v.setVideoId, v])).values()];
  const result = [];
  for (let i = 0; i < unique.length; i += BATCH_SIZE) result.push(unique.slice(i, i + BATCH_SIZE));
  return result;
}
export function confirmRemoval(result) {
  if (result?.error || result?.status !== 'STATUS_SUCCEEDED') {
    throw new Error('YouTube did not confirm this batch. Refresh the playlist before trying again.');
  }
}
