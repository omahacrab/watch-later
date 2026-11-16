// Serialized by chrome.scripting. Keep this function entirely self-contained.
// Auth is generated inside YouTube's page; cookies and auth headers never leave it.
export async function youtubeRequest(operation, payload = {}) {
  try {
    if (location.origin !== 'https://www.youtube.com') throw new Error('Open YouTube first.');
    const get = key => window.ytcfg?.get?.(key);
    const context = get('INNERTUBE_CONTEXT');
    if (!context?.client) throw new Error('YouTube is still loading. Wait a few seconds and reconnect.');
    if (get('LOGGED_IN') === false) throw new Error('Sign in to YouTube first.');
    const identity = get('DATASYNC_ID');
    if (!identity) throw new Error('Could not identify the signed-in YouTube account. Reload Watch Later and reconnect.');
    const digest = async (algorithm, value) => [...new Uint8Array(await crypto.subtle.digest(algorithm, new TextEncoder().encode(value)))].map(b => b.toString(16).padStart(2, '0')).join('');
    const account = await digest('SHA-256', `${identity}|${get('DELEGATED_SESSION_ID') || ''}`);
    if (payload.account && payload.account !== account) throw new Error('YouTube account changed. Reconnect and load its playlist before removing anything.');
    if (operation === 'identity') {
      const onWatchLater = location.pathname === '/playlist' && new URL(location.href).searchParams.get('list') === 'WL';
      const pageCountText = onWatchLater ? [...document.querySelectorAll('ytd-playlist-header-renderer, ytd-playlist-sidebar-primary-info-renderer, ytd-page-header-renderer')].map(node => node.innerText || '').join('\n') : '';
      return {ok: true, account, pageCountText};
    }
    if(operation==='page-data'){
      if(location.pathname!=='/playlist' || new URL(location.href).searchParams.get('list')!==(payload.playlistId||'WL'))return {ok:true,account,data:{}};
      const page = document.querySelector('ytd-browse[page-subtype="playlist"]');
      return {ok:true,account,data:page?.data || {}};
    }
    if (!['browse', 'remove', 'restore', 'playlists', 'create-playlist', 'add-to-playlist', 'delete-playlist', 'channel-search', 'channel-browse'].includes(operation)) throw new Error('Unknown operation.');
    const cookies = Object.fromEntries(document.cookie.split(';').map(s => {
      const index = s.indexOf('=');
      return [s.slice(0, index).trim(), s.slice(index + 1)];
    }));
    const sapisid = cookies.SAPISID || cookies['__Secure-3PAPISID'];
    if (!sapisid) throw new Error('YouTube sign-in credentials are unavailable. Reload YouTube and reconnect.');
    const timestamp = Math.floor(Date.now() / 1000);
    const authHash = await digest('SHA-1', `${timestamp} ${sapisid} ${location.origin}`);
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `SAPISIDHASH ${timestamp}_${authHash}`,
      'X-Origin': location.origin,
      'X-Goog-AuthUser': String(get('SESSION_INDEX') || 0),
      'X-Youtube-Client-Name': String(get('INNERTUBE_CONTEXT_CLIENT_NAME') || 1),
      'X-Youtube-Client-Version': String(get('INNERTUBE_CLIENT_VERSION') || context.client.clientVersion)
    };
    if (get('DELEGATED_SESSION_ID')) headers['X-Goog-PageId'] = get('DELEGATED_SESSION_ID');
    const body = {context: structuredClone(context)};
    let endpoint = 'browse';
    if (operation === 'channel-search') {
      endpoint='search';
      if(payload.token)body.continuation=payload.token;
      else {if(typeof payload.query!=='string'||!payload.query.trim())throw new Error('Enter a channel name.');body.query=payload.query.trim();body.params='EgIQAg==';}
    } else if(operation==='channel-browse') {
      if(payload.token)body.continuation=payload.token;
      else {if(!/^UC[a-zA-Z0-9_-]{22}$/.test(payload.channelId||''))throw new Error('Search YouTube to resolve this channel ID.');body.browseId=payload.channelId;if(payload.params)body.params=payload.params;}
    } else if (operation === 'playlists') {
      endpoint='playlist/get_add_to_playlist';
      if(typeof payload.videoId!=='string'||!payload.videoId.trim())throw new Error('An available video is required to load editable playlists.');
      body.videoIds = [payload.videoId];
      body.excludeWatchLater = true;
    } else if (operation === 'delete-playlist') {
      if(!payload.account || typeof payload.playlistId!=='string' || !/^PL[a-zA-Z0-9_-]+$/.test(payload.playlistId))throw new Error('Only regular user-created playlists can be deleted.');
      endpoint='playlist/delete';body.playlistId=payload.playlistId;
    } else if (operation === 'create-playlist') {
      if(!payload.account || typeof payload.title!=='string' || !payload.title.trim() || payload.title.length>150)throw new Error('Enter a playlist name (up to 150 characters).');
      endpoint='playlist/create';body.title=payload.title.trim();body.privacyStatus='PRIVATE';body.videoIds=[];
    } else if (operation === 'browse') {
      if (payload.token) body.continuation = payload.token;
      else {
        const playlist=payload.playlistId || 'WL';
        if(!/^[a-zA-Z0-9_-]+$/.test(playlist))throw new Error('Invalid playlist ID.');
        body.browseId = `VL${playlist}`;
        if(typeof payload.params==='string' && playlist)body.params=payload.params;
      }
    } else {
      if (!payload.account || !Array.isArray(payload.ids) || payload.ids.length < 1 || payload.ids.length > 500 || payload.ids.some(id => typeof id !== 'string' || !id)) throw new Error('Invalid removal selection.');
      endpoint = 'browse/edit_playlist';
      body.playlistId = payload.playlistId || 'WL';
      if(!/^(?:WL|PL[a-zA-Z0-9_-]+)$/.test(body.playlistId))throw new Error('Only Watch Later and regular editable playlists can be changed.');
      if(operation === 'add-to-playlist' && (typeof body.playlistId!=='string' || !/^[a-zA-Z0-9_-]+$/.test(body.playlistId) || body.playlistId==='LL'))throw new Error('Choose a destination playlist.');
      body.actions = ['restore','add-to-playlist'].includes(operation)
        ? [...new Set(payload.ids)].map(addedVideoId => ({addedVideoId, action: 'ACTION_ADD_VIDEO'}))
        : [...new Set(payload.ids)].map(setVideoId => ({setVideoId, action: 'ACTION_REMOVE_VIDEO'}));
    }
    const response = await fetch(`/youtubei/v1/${endpoint}?prettyPrint=false`, {
      method: 'POST', credentials: 'include', cache: 'no-store', headers, body: JSON.stringify(body),
      signal: AbortSignal.timeout(25000)
    });
    if (!response.ok) {
      const advice=response.status===400?'YouTube rejected the request format.':response.status===429?'YouTube is rate-limiting requests. Wait before trying again.':'Reload YouTube and reconnect.';
      throw new Error(`YouTube returned HTTP ${response.status}. ${advice}`);
    }
    const data = await response.json();
    if (data.error) throw new Error(`YouTube rejected the request (${data.error.code || 'unknown error'}).`);
    return {ok: true, account, data};
  } catch (error) {
    return {ok: false, error: error.name === 'TimeoutError' ? 'Request timed out. If removing, refresh the playlist to reconcile the result.' : error.message};
  }
}
