/* Shared reset generation: an old tab must never restore a deleted draft snapshot. */
(function (root) {
  'use strict';
  const epoch = source => Math.max(0, Date.parse(source?.resetAt || '') || 0);
  const updated = item => Date.parse(item?.updatedAt || '') || 0;
  const fields = ['memo', 'edits', 'title', 'createdRecord'];
  const timestamp = item => new Date(Math.max(Date.now(), updated(item) + 1,
    ...fields.map(field => (Date.parse(item?.fieldUpdatedAt?.[field] || '') || 0) + 1))).toISOString();
  const hasContent = item => Boolean(item?.createdRecord || item?.memo?.trim() || Object.keys(item?.edits || {}).length || Object.keys(item?.conflicts || {}).length);
  const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const canonical = value => value && typeof value === 'object'
    ? Array.isArray(value) ? `[${value.map(canonical).join(',')}]`
      : `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`
    : JSON.stringify(value);
  const choiceKey = choice => choice.present ? `1:${canonical(choice.value)}` : '0';
  const hasConflicts = item => Boolean(Object.keys(item?.conflicts || {}).length);
  const isTrashed = item => Boolean(item?.createdRecord?.trashedAt ||
    item?.conflicts?.createdRecord?.some(choice => choice.present && choice.value?.trashedAt));
  const choiceSignature = choices => choices.map(choice=>`${Date.parse(choice.updatedAt)}:${choiceKey(choice)}`).sort().join('\n');
  function orderChoices(choices) {
    const unique = new Map();
    for (const choice of choices) {
      const key = choiceKey(choice), old = unique.get(key);
      if (!old || Date.parse(choice.updatedAt) > Date.parse(old.updatedAt)) unique.set(key,{...choice,updatedAt:new Date(Date.parse(choice.updatedAt)).toISOString()});
    }
    return [...unique.values()].sort((a,b)=>Date.parse(b.updatedAt)-Date.parse(a.updatedAt) ||
      (choiceKey(a)<choiceKey(b)?-1:choiceKey(a)>choiceKey(b)?1:0));
  }
  function validDate(value) {
    if (typeof value !== 'string') return false;
    const parts = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:T([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(?:\.\d{1,9})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d))?$/);
    if (!parts || Number(parts[1]) < 1) return false;
    const [, year, month, day] = parts.map(Number);
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    const time = Date.parse(value);
    return month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1] &&
      time >= Date.parse('0001-01-01T00:00:00Z') && time <= Date.parse('9999-12-31T23:59:59.999Z');
  }
  function validValues(values) {
    if (!record(values)) return false;
    for (const [key, value] of Object.entries(values)) {
      if (key === 'day' && value !== null && (!Number.isInteger(value) || value < 0 || value > 12)) return false;
      if (['time_start', 'time_estimate', 'time_end'].includes(key) && value !== null && value !== '' &&
          (typeof value !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value))) return false;
      if (['description', 'location', 'type', 'notes', 'room', 'status', 'role', 'nen_ability', 'appearance', 'nen_type', 'ability'].includes(key) &&
          (key === 'description' ? typeof value !== 'string' || !value.trim() : value !== null && typeof value !== 'string')) return false;
    }
    return !(values.time_start && values.time_estimate);
  }
  function finiteNumbers(value) {
    if (typeof value === 'number') return Number.isFinite(value);
    if (value && typeof value === 'object') return Object.values(value).every(finiteNumbers);
    return true;
  }
  function validItem(item) {
    if (!record(item) || ['memo', 'title'].some(key => item[key] !== undefined && typeof item[key] !== 'string') ||
        (Object.hasOwn(item, 'updatedAt') && !validDate(item.updatedAt)) ||
        (item.edits !== undefined && !validValues(item.edits))) return false;
    if (item.createdRecord !== undefined) {
      const created = item.createdRecord;
      if (!validValues(created) || (Object.hasOwn(created, 'trashedAt') && !validDate(created.trashedAt)) || ['chapter', 'chapter_order'].some(key => created[key] !== undefined &&
          (!Number.isInteger(created[key]) || created[key] < 1)) ||
          (created.characters !== undefined && (!Array.isArray(created.characters) || created.characters.some(id => typeof id !== 'string')))) return false;
    }
    if (item.fieldUpdatedAt !== undefined && (!record(item.fieldUpdatedAt) ||
        !Object.entries(item.fieldUpdatedAt).every(([key, value]) => fields.includes(key) && validDate(value)))) return false;
    if (item.conflicts !== undefined) {
      if (!record(item.conflicts)) return false;
      for (const [field, choices] of Object.entries(item.conflicts)) {
        if (!fields.includes(field) || !Array.isArray(choices) || choices.length < 2) return false;
        const seen = new Set();
        for (const choice of choices) {
          if (!record(choice) || typeof choice.present !== 'boolean' || !validDate(choice.updatedAt) ||
              Date.parse(choice.updatedAt) !== fieldTime(item, field)) return false;
          if (choice.present ? !Object.hasOwn(choice, 'value') || !validItem({[field]: choice.value}) : Object.hasOwn(choice, 'value')) return false;
          const key = choiceKey(choice);
          if (seen.has(key)) return false;
          seen.add(key);
        }
        if (Math.max(...choices.map(choice=>Date.parse(choice.updatedAt))) !== fieldTime(item,field) ||
            !seen.has(choiceKey({present:Object.hasOwn(item,field),value:item[field]}))) return false;
      }
    }
    return true;
  }
  function validateSnapshot(source, {required = false} = {}) {
    if (source == null && !required) return source;
    if (!record(source) || ![1,2].includes(source.version) || !record(source.items) || !finiteNumbers(source) ||
        (source.format !== undefined && source.format !== 'hxh-succession-local-drafts') ||
        ['resetAt', 'exportedAt'].some(key => Object.hasOwn(source, key) && !validDate(source[key])) ||
        (source.entries !== undefined && (!Array.isArray(source.entries) || source.entries.some(entry => !record(entry) ||
          ['key', 'memo', 'title'].some(key => entry[key] !== undefined && typeof entry[key] !== 'string') ||
          (entry.updatedAt != null && !validDate(entry.updatedAt))))) ||
        Object.entries(source.items).some(([key, item]) => !key.trim() || ['__proto__', 'constructor', 'prototype'].includes(key) || !validItem(item) ||
          (source.version === 1 && hasConflicts(item)))) {
      throw new Error('メモの保存データの形式が正しくありません。元のデータは変更していません。');
    }
    return source;
  }
  const fieldTime = (item, field) => {
    const value = Date.parse(item?.fieldUpdatedAt?.[field] || '');
    return Number.isFinite(value) ? value : updated(item);
  };
  function editItem(previous = {}, changes, {resolve} = {}) {
    const updatedAt = timestamp(previous);
    // Stamp unchanged fields with their old date, including absent fields. This
    // lets a memo save retain edits made elsewhere from the same starting record.
    const conflicts = {...previous.conflicts};
    const fieldUpdatedAt = Object.fromEntries(fields.map(field => {
      const changed = Object.hasOwn(changes, field) &&
        (resolve === field || canonical(changes[field]) !== canonical(previous[field]) ||
          Object.hasOwn(previous,field) !== (changes[field] !== undefined));
      if (changed) delete conflicts[field];
      return [field, changed ? updatedAt : new Date(fieldTime(previous, field)).toISOString()];
    }));
    const result = {...previous, ...changes, updatedAt, fieldUpdatedAt};
    for (const field of fields) if (Object.hasOwn(changes,field) && changes[field] === undefined) delete result[field];
    if (Object.keys(conflicts).length) result.conflicts = conflicts;
    else delete result.conflicts;
    return result;
  }
  function resolveConflict(item, field, choice, expectedChoices = item?.conflicts?.[field]) {
    if (!item?.conflicts?.[field]?.some(candidate => choiceKey(candidate) === choiceKey(choice)) ||
        !expectedChoices || choiceSignature(expectedChoices) !== choiceSignature(item.conflicts[field])) {
      throw new Error('競合した内容が更新されています。読み直してから選んでください。');
    }
    return editItem(item,{[field]:choice.present ? choice.value : undefined},{resolve:field});
  }
  function setTrashed(item, trashed) {
    if (!/^LOCAL-[a-zA-Z0-9-]+$/.test(item?.createdRecord?.id || '')) throw new Error('個人で追加した出来事だけをゴミ箱へ移せます。');
    const when = timestamp(item);
    const mark = value => {
      const record = {...value};
      if (trashed) record.trashedAt = when;
      else delete record.trashedAt;
      return record;
    };
    const result = editItem(item, {createdRecord:mark(item.createdRecord)}, {resolve:'createdRecord'});
    // Moving an event is not a choice between conflicting event descriptions.
    if (item.conflicts?.createdRecord) {
      const choices = orderChoices(item.conflicts.createdRecord.map(choice => ({...choice,
        ...(choice.present ? {value:mark(choice.value)} : {}), updatedAt:result.fieldUpdatedAt.createdRecord})));
      if (choices.length > 1) result.conflicts = {...result.conflicts, createdRecord:choices};
    }
    return result;
  }
  function mergeItem(current, incoming) {
    if (!current) return incoming;
    const later = updated(incoming) - updated(current);
    const latest = later > 0 || (later === 0 && canonical(incoming) > canonical(current)) ? incoming : current;
    const result = {...latest, updatedAt:new Date(Math.max(updated(current),updated(incoming))).toISOString(), fieldUpdatedAt: {}, conflicts: {}};
    for (const field of fields) {
      const time = Math.max(fieldTime(current,field),fieldTime(incoming,field));
      const choices = [];
      for (const item of [current,incoming]) {
        if (fieldTime(item,field) !== time) continue;
        choices.push({present:Object.hasOwn(item,field),...(Object.hasOwn(item,field)?{value:item[field]}:{}),updatedAt:new Date(time).toISOString()},...(item.conflicts?.[field] || []));
      }
      const ordered = orderChoices(choices);
      const chosen = ordered[0];
      result.fieldUpdatedAt[field] = chosen.updatedAt;
      if (chosen.present) result[field] = chosen.value;
      else delete result[field];
      if (ordered.length > 1) result.conflicts[field] = ordered;
    }
    if (!hasConflicts(result)) {
      delete result.conflicts;
      if (!current.fieldUpdatedAt && !incoming.fieldUpdatedAt && !current.conflicts && !incoming.conflicts) return latest;
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
    // Every new write uses v2 so an older client cannot strip conflict metadata.
    return {version:2, ...(resetTime ? {resetAt: new Date(resetTime).toISOString()} : {}), items};
  }
  function reset(source, now = Date.now()) {
    return {version:2, resetAt: new Date(Math.max(now, epoch(source) + 1)).toISOString(), items: {}};
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
    validateSnapshot(source, {required: true});
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
      validateSnapshot(source, {required: true});
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
        if (file?.format !== 'hxh-succession-local-drafts' || ![1,2].includes(file.version) ||
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
  const api = {epoch, merge, reset, timestamp, editItem, hasContent, envelope, persist, validateSnapshot, checkpoint, validDate, resolveConflict, hasConflicts, isTrashed, setTrashed};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.DraftState = api;
})(typeof window === 'undefined' ? globalThis : window);
