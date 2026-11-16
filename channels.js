const normalize = text => String(text || '').normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();
export function extractChannels(renderer) {
  const found = new Map();
  for (const byline of [renderer.shortBylineText, renderer.longBylineText, renderer.ownerText]) {
    for (const run of byline?.runs || []) {
      const endpoint = run.navigationEndpoint?.browseEndpoint;
      if (endpoint?.browseId && run.text?.trim()) {
        found.set(endpoint.browseId,{id:endpoint.browseId,name:run.text.trim()});
      }
    }
  }
  return [...found.values()];
}
export function channelIndex(videos) {
  const names = new Map();
  for (const video of videos) {
    for (const channel of video.channels || []) {
      const key = normalize(channel.name);
      if (key) names.set(key,{id:channel.id || '',name:channel.name});
    }
  }
  for (const video of videos) {
    const name = video.channel?.trim();
    if (name && !names.has(normalize(name))) names.set(normalize(name),{id:'',name});
  }
  return names;
}
export function channelsFor(video, index) {
  const linked = video.channels || [];
  // Recover legacy cached multi-channel labels only when every component has
  // independent evidence in this playlist. Do not blindly split channel names.
  const pieces = (video.channel || '').split(/\s+and\s+|\s+&\s+|,\s*/i).map(s=>s.trim()).filter(Boolean);
  const inferred = pieces.length > 1 && pieces.every(name=>index.has(normalize(name)))
    ? pieces.map(name=>index.get(normalize(name))) : [];
  const candidates = linked.length > 1 ? linked : inferred.length > 1
    ? [...linked,...inferred] : linked.length ? linked : video.channel ? [index.get(normalize(video.channel)) || {id:'',name:video.channel}] : [];
  const unique = [];
  for (const c of candidates) {
    const previous = unique.find(v => (v.id && c.id && v.id === c.id) || normalize(v.name) === normalize(c.name));
    if (!previous) unique.push({...c});
    else if (!previous.id && c.id) previous.id=c.id;
  }
  return unique;
}
export function sharesChannel(video, selected, index) {
  return channelsFor(video,index).some(candidate => selected.some(channel =>
    candidate.id && channel.id ? candidate.id === channel.id : normalize(candidate.name) === normalize(channel.name)
  ));
}
