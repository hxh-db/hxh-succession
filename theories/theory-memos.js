/* Article notes use the same private drafts as the database; never edit article HTML. */
(function (root) {
  'use strict';
  const KEY = 'hxh-succession-local-drafts-v1';
  const state = typeof module !== 'undefined' && module.exports ? require('../draft-state.js') : root.DraftState;
  const merge = state.merge;
  function createStore({storage, fetcher, api}) {
    let drafts = {version: 1, items: {}};
    let queue = Promise.resolve();
    const submitted = new Map();
    const browser = () => {
      let raw;
      try { raw = storage.getItem(KEY); } catch (_) { return null; }
      return state.validateSnapshot(raw == null ? null : JSON.parse(raw));
    };
    const file = async () => {
      const response = await fetcher(api, {cache: 'no-store', signal: AbortSignal.timeout(8000)});
      if (!response.ok) throw new Error('メモファイルを読み込めませんでした');
      const payload = await response.json();
      if (payload?.format !== 'hxh-succession-local-drafts' || ![1,2].includes(payload.version) ||
          !payload.items || typeof payload.items !== 'object' || Array.isArray(payload.items)) {
        throw new Error('メモファイルの形式が不正です');
      }
      state.validateSnapshot(payload);
      return payload;
    };
    return {
      async load(key) {
        drafts = merge(browser(), api ? await file() : null);
        const memo = drafts.items[key]?.memo || '';
        submitted.set(key,memo.trim());
        return memo;
      },
      item(key) {return drafts.items[key] || {};},
      refresh(key) {
        drafts=merge(drafts,browser());
        const memo=drafts.items[key]?.memo || '';
        submitted.set(key,memo.trim());
        return memo;
      },
      save(key, title, memo) {
        const text=memo.trim(), previous=drafts.items[key] || {};
        const changes={...(previous.title===undefined?{title}:{}),
          ...(!submitted.has(key) || submitted.get(key)!==text?{memo:text}:{})};
        const edited = state.editItem(previous,changes);
        submitted.set(key,text);
        const snapshot = {...drafts, items: {...drafts.items, [key]: edited}};
        drafts = snapshot;
        const task = queue.catch(() => {}).then(async () => {
          // Reload before writing so notes made on other pages are not replaced by a stale snapshot.
          const current = merge(browser(), api ? await file() : null);
          if (state.epoch(current) > state.epoch(snapshot)) {
            throw new Error('別のページでメモがリセットされました。再読み込みしてから新しく入力してください。');
          }
          const saved = await state.persist({source: merge(current, snapshot), storage, key: KEY, fetcher, api});
          drafts = merge(saved, drafts);
          if(!state.hasConflicts(drafts.items[key])) submitted.set(key,(drafts.items[key]?.memo || '').trim());
        });
        queue = task;
        return task;
      },
      checkpoint(key, title, memo) {
        const text=memo.trim(),previous=drafts.items[key] || {};
        const edited = state.editItem(previous,{...(previous.title===undefined?{title}:{}),
          ...(!submitted.has(key) || submitted.get(key)!==text?{memo:text}:{})});
        submitted.set(key,text);
        drafts = state.checkpoint({source: {...drafts, items: {...drafts.items, [key]: edited}}, storage, key: KEY});
      },
      resolve(key,field,choice,expected) {
        const task=queue.catch(()=>{}).then(async()=>{
          const current=merge(drafts,browser(),api?await file():null);
          if(state.epoch(current)>state.epoch(drafts)) throw new Error('別のページでメモがリセットされました。再読み込みしてください。');
          drafts=current;
          const item=state.resolveConflict(current.items[key],field,choice,expected);
          const saved=await state.persist({source:{...current,items:{...current.items,[key]:item}},storage,key:KEY,fetcher,api});
          drafts=merge(saved,drafts);
          submitted.set(key,(drafts.items[key]?.memo || '').trim());
          return drafts.items[key];
        });
        queue=task;
        return task;
      }
    };
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = {createStore, merge, KEY};
  if (!root.document) return;
  const main = document.querySelector('[data-theory-id]');
  if (!main) return;
  const scriptUrl = document.currentScript.src;
  const api = ['127.0.0.1', 'localhost'].includes(location.hostname)
    ? new URL('../api/drafts', scriptUrl).href : null;
  let storage;
  try { storage = localStorage; } catch (_) { storage = {getItem() { return null; }, setItem() { throw new Error('Storage unavailable'); }}; }
  const store = createStore({storage, fetcher: (...args) => fetch(...args), api});
  const key = `theory:${main.dataset.theoryId}`;
  const title = `謎・考察：${(main.querySelector('.essay-title') || main.querySelector('h1')).textContent.trim()}`;
  const details = document.createElement('details');
  details.className = 'local-editor-collapsed';
  const summary = document.createElement('summary'); summary.textContent = 'この記事にメモ';
  const section = document.createElement('section'); section.className = 'local-editor';
  const help = document.createElement('p'); help.className = 'local-editor-help';
  help.textContent = api ? '入力すると自動でこのPCに保存します。記事や公開データは変わりません。'
    : '入力するとこのブラウザに自動保存します。他の端末とは共有されません。';
  const label = document.createElement('label'); label.className = 'local-editor-label';
  label.textContent = '気付いたことをメモ';
  const memo = document.createElement('textarea'); memo.rows = 5; memo.disabled = true;
  memo.placeholder = '例：この説を補強する場面／反証になりそうな情報'; label.appendChild(memo);
  const button = document.createElement('button'); button.type = 'button'; button.className = 'local-editor-button';
  button.textContent = '今すぐ保存'; button.disabled = true;
  const status = document.createElement('p'); status.className = 'local-editor-status'; status.setAttribute('role', 'status');
  const backup = document.createElement('a'); backup.href = new URL('../index.html', scriptUrl).href;
  backup.textContent = 'メモ一覧・JSONバックアップはデータベース上部から';
  section.append(help, label, button, status, backup); details.append(summary, section);
  (main.querySelector('.spoiler-article') || main).appendChild(details);
  let timer;
  let revision = 0;
  let unsaved = false, saving = 0;
  let resetBlocked = false;
  const conflictBox=document.createElement('div');section.appendChild(conflictBox);
  const refreshConflicts=root.DraftConflicts.render(conflictBox,{getItem:()=>store.item(key),onResolve:async(field,choice,expected)=>{
    if(resetBlocked) throw new Error('別のページでリセットされました。再読み込みしてください。');
    if(timer) await save();
    memo.disabled=button.disabled=true;
    try {
      const item=await store.resolve(key,field,choice,expected);
      memo.value=item?.memo || '';unsaved=false;
      status.textContent='選んだ内容を保存しました。';
    } finally {memo.disabled=button.disabled=resetBlocked;updateExitGuard();}
  }});
  function checkpoint() {
    if (!unsaved && !timer && !saving) return true;
    try { store.checkpoint(key, title, memo.value); return true; }
    catch (_) { return false; }
  }
  function guardExit(event) {
    if (checkpoint()) return;
    event.preventDefault(); event.returnValue = '';
  }
  function updateExitGuard() {
    if (unsaved || timer || saving) window.addEventListener('beforeunload', guardExit);
    else window.removeEventListener('beforeunload', guardExit);
  }
  async function save() {
    clearTimeout(timer); timer = null;
    const current = revision;
    saving++; unsaved = true; updateExitGuard();
    status.textContent = '保存中…';
    try {
      await store.save(key, title, memo.value);
      refreshConflicts();
      if (current === revision) {
        if(!state.hasConflicts(store.item(key))) memo.value=store.item(key).memo || '';
        unsaved = false;
        status.textContent = api ? 'PCに保存しました。' : 'ブラウザに保存しました。';
      }
    } catch (error) { status.textContent = error.message; }
    finally { saving--; updateExitGuard(); }
  }
  memo.addEventListener('input', () => { revision++; unsaved = true; clearTimeout(timer); status.textContent = '保存中…'; timer = setTimeout(save, 650); updateExitGuard(); });
  memo.addEventListener('blur', () => { if (timer) save(); });
  button.addEventListener('click', save);
  window.addEventListener('pagehide', checkpoint);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && (unsaved || timer)) { checkpoint(); save(); }
  });
  window.addEventListener('storage', event => {
    if (event.key !== KEY || !event.newValue) return;
    try {
      if (state.epoch(JSON.parse(event.newValue)) > state.epoch(JSON.parse(event.oldValue || 'null'))) {
        clearTimeout(timer); timer = null; revision++;
        unsaved = false; resetBlocked=true; updateExitGuard();
        memo.disabled = button.disabled = true;
        memo.value = '';
        status.textContent = '別のページでメモがリセットされました。再読み込みしてから新しく入力してください。';
      } else if(!unsaved && !timer && !saving && !resetBlocked) {
        memo.value=store.refresh(key);refreshConflicts();
      }
    } catch (_) { /* Ignore malformed storage. */ }
  });
  store.load(key).then(value => { memo.value = value; memo.disabled = false; button.disabled = false; refreshConflicts(); })
    .catch(() => { status.textContent = '既存メモを読み込めませんでした。上書きを避けるため、ページを再読み込みしてください。'; });
})(typeof window === 'undefined' ? globalThis : window);
