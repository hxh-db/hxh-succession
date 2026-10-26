/* Shared reset generation: an old tab must never restore a deleted draft snapshot. */
(function (root) {
  'use strict';
  const epoch = source => Date.parse(source?.resetAt || '') || 0;
  const updated = item => Date.parse(item?.updatedAt || '') || 0;
  const fields = ['memo', 'edits', 'title', 'createdRecord'];
  const timestamp = item => new Date(Math.max(Date.now(), updated(item) + 1,
    ...fields.map(field => (Date.parse(item?.fieldUpdatedAt?.[field] || '') || 0) + 1))).toISOString();
  const hasContent = item => Boolean(item?.createdRecord || item?.memo?.trim() || Object.keys(item?.edits || {}).length);
  function validateSnapshot(source) {
    if (source == null) return source;
    const record = value => value && typeof value === 'object' && !Array.isArray(value);
    if (!record(source) || source.version !== 1 || !record(source.items) ||
        Object.values(source.items).some(item => !record(item) ||
          ['memo', 'title'].some(key => item[key] !== undefined && typeof item[key] !== 'string') ||
          (item.edits !== undefined && !record(item.edits)) ||
          (item.createdRecord !== undefined && !record(item.createdRecord)) ||
          (item.fieldUpdatedAt !== undefined && (!record(item.fieldUpdatedAt) ||
            Object.entries(item.fieldUpdatedAt).some(([key, value]) => !fields.includes(key) ||
              typeof value !== 'string' || !Number.isFinite(Date.parse(value))))))) {
      throw new Error('メモの保存データの形式が正しくありません。元のデータは変更していません。');
    }
    return source;
  }
  const fieldTime = (item, field) => {
    const value = Date.parse(item?.fieldUpdatedAt?.[field] || '');
    return Number.isFinite(value) ? value : updated(item);
  };
  function editItem(previous = {}, changes) {
    const updatedAt = timestamp(previous);
    // Stamp unchanged fields with their old date, including absent fields. This
    // lets a memo save retain edits made elsewhere from the same starting record.
    const fieldUpdatedAt = Object.fromEntries(fields.map(field => [field,
      Object.hasOwn(changes, field) ? updatedAt : new Date(fieldTime(previous, field)).toISOString()]));
    return {...previous, ...changes, updatedAt, fieldUpdatedAt};
  }
  function mergeItem(current, incoming) {
    if (!current) return incoming;
    const latest = updated(incoming) >= updated(current) ? incoming : current;
    if (!current.fieldUpdatedAt && !incoming.fieldUpdatedAt) return latest;
    const result = {...latest, fieldUpdatedAt: {}};
    for (const field of fields) {
      const chosen = fieldTime(incoming, field) >= fieldTime(current, field) ? incoming : current;
      result.fieldUpdatedAt[field] = new Date(fieldTime(chosen, field)).toISOString();
      if (Object.hasOwn(chosen, field)) result[field] = chosen[field];
      else delete result[field];
    }
    return result;
  }
  function merge(...sources) {
    const resetTime = Math.max(0, ...sources.map(epoch));
    const items = {};
    for (const source of sources) {
      if (epoch(source) !== resetTime) continue;
      for (const [key, item] of Object.entries(source?.items || {})) {
        items[key] = mergeItem(items[key], item);
      }
    }
    return {version: 1, ...(resetTime ? {resetAt: new Date(resetTime).toISOString()} : {}), items};
  }
  function reset(source, now = Date.now()) {
    return {version: 1, resetAt: new Date(Math.max(now, epoch(source) + 1)).toISOString(), items: {}};
  }
  function readBrowser(storage, key) {
    let raw;
    try { raw = storage.getItem(key); } catch (_) { return null; }
    if (raw == null) return null;
    try { return validateSnapshot(JSON.parse(raw)); }
    catch (_) { throw new Error('ブラウザのメモを読み込めません。元のデータを残すため保存を停止しました。再読み込みしてください。'); }
  }
  // Lifecycle handlers cannot wait for an HTTP request or a Web Lock callback.
  function checkpoint({source, storage, key}) {
    validateSnapshot(source);
    const current = readBrowser(storage, key);
    if (epoch(current) > epoch(source)) throw new Error('別のページでメモがリセットされました。再読み込みしてください。');
    const pending = merge(current, source);
    storage.setItem(key, JSON.stringify(pending));
    return pending;
  }
  // Serialize tabs when available. File revisions also protect writes from another browser.
  function withLock(task) {
    return root.navigator?.locks?.request
      ? root.navigator.locks.request('hxh-succession-drafts', task) : task();
  }
  function envelope(source, labels = []) {
    const titles = new Map(labels.map(entry => [entry.key, entry.title]));
    return {format: 'hxh-succession-local-drafts', ...source, exportedAt: new Date().toISOString(),
      entries: Object.entries(source.items).filter(([, item]) => hasContent(item)).map(([key, item]) => ({
        key, title: titles.get(key) || item.title || item.createdRecord?.description || key,
        memo: item.memo || '', edits: item.edits || {}, isNew: Boolean(item.createdRecord), updatedAt: item.updatedAt || null
      }))};
  }
  async function persist({source, storage, key, fetcher, api}) {
    return withLock(async () => {
      validateSnapshot(source);
      let pending = merge(source);
      const combine = current => {
        if (epoch(current) > epoch(source)) throw new Error('別のページでメモがリセットされました。再読み込みしてください。');
        pending = merge(current, pending);
      };
      let browserSaved = false;
      const saveBrowser = () => {
        // A lifecycle checkpoint can run while an HTTP request holds the Web Lock.
        // Re-read before every write, including after GET and conflict retries.
        combine(readBrowser(storage, key));
        try { storage.setItem(key, JSON.stringify(pending)); browserSaved = true; } catch (_) { browserSaved = false; }
      };
      const current = readBrowser(storage, key);
      combine(current);
      saveBrowser();
      if (!api) {
        if (!browserSaved) throw new Error('ブラウザに保存できませんでした。メモをコピーして控えてください。');
        return pending;
      }
      for (let attempt = 0; attempt < 3; attempt++) {
        const response = await fetcher(api, {cache: 'no-store', signal: AbortSignal.timeout(8000)});
        if (!response.ok) throw new Error('PCのメモを読み込めませんでした。');
        const file = await response.json();
        if (file?.format !== 'hxh-succession-local-drafts' || file.version !== 1 ||
            !file.items || typeof file.items !== 'object' || Array.isArray(file.items)) {
          throw new Error('PCのメモの形式が正しくありません。元ファイルは残しています。');
        }
        validateSnapshot(file);
        combine(file);
        saveBrowser();
        const revision = response.headers?.get('ETag');
        const result = await fetcher(api, {method: 'PUT', signal: AbortSignal.timeout(8000), headers: {'Content-Type': 'application/json',
          ...(revision ? {'If-Match': revision} : {})}, body: JSON.stringify(envelope(pending, source.entries))});
        if (result.status === 412) continue;
        if (result.status === 428) throw new Error('保存方式が更新されました。メモを控えて、ページを再読み込みしてください。');
        if (!result.ok) throw new Error('PCへの保存に失敗しました。入力内容をコピーして控え、もう一度保存してください。');
        return pending;
      }
      throw new Error('別のページの保存と重なりました。メモ欄を残したまま、もう一度保存してください。');
    });
  }
  const api = {epoch, merge, reset, timestamp, editItem, hasContent, envelope, persist, validateSnapshot, checkpoint};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.DraftState = api;
})(typeof window === 'undefined' ? globalThis : window);
