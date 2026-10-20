/* Shared reset generation: an old tab must never restore a deleted draft snapshot. */
(function (root) {
  'use strict';
  const epoch = source => Date.parse(source?.resetAt || '') || 0;
  function merge(...sources) {
    const resetTime = Math.max(0, ...sources.map(epoch));
    const items = {};
    for (const source of sources) {
      if (epoch(source) !== resetTime) continue;
      for (const [key, item] of Object.entries(source?.items || {})) {
        if (!items[key] || (item.updatedAt || '') >= (items[key].updatedAt || '')) items[key] = item;
      }
    }
    return {version: 1, ...(resetTime ? {resetAt: new Date(resetTime).toISOString()} : {}), items};
  }
  function reset(source, now = Date.now()) {
    return {version: 1, resetAt: new Date(Math.max(now, epoch(source) + 1)).toISOString(), items: {}};
  }
  const api = {epoch, merge, reset};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.DraftState = api;
})(typeof window === 'undefined' ? globalThis : window);
