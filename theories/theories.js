/* Shared spoiler preference is read, never changed by opening one article. */
try {
  if (localStorage.getItem('hxh-succession-spoilers-revealed-v1') === 'true') {
    document.querySelectorAll('.spoiler-article').forEach(el => { el.open = true; });
  }
} catch (_) { /* Private browsing: keep the safe collapsed default. */ }
// 根拠詳細から戻るリンクは、この記事だけを開く。全体のネタバレ設定は変えない。
if (location.hash === '#evidence') {
  const article = document.querySelector('.spoiler-article');
  if (article) {
    article.open = true;
    const evidence = document.getElementById('evidence');
    if (evidence?.tagName === 'DETAILS') evidence.open = true;
    document.getElementById('evidence')?.scrollIntoView();
  }
}
document.querySelectorAll('a[href="#evidence"]').forEach(link => link.addEventListener('click', () => {
  const evidence = document.getElementById('evidence');
  if (evidence?.tagName === 'DETAILS') evidence.open = true;
}));
const search = document.getElementById('essay-search');
const articleState = () => {
  const params = new URL(location.href).searchParams;
  return {q: params.get('q') || '', category: params.get('category') || ''};
};
const carryState = (link, state) => {
  const url = new URL(link.getAttribute('href'), location.href);
  for (const key of ['q', 'category']) {
    if (state[key]) url.searchParams.set(key, state[key]);
    else url.searchParams.delete(key);
  }
  link.href = url.href;
};
// URLだけで復元できるよう、一覧へのリンク・関連記事にも条件を渡す。
if (!search) {
  document.querySelectorAll('main a[href="../"], main a[href^="../Q"], main a[href^="../emperor-time/"]').forEach(link => carryState(link, articleState()));
  document.querySelectorAll('.evidence a').forEach(link => {
    const url = new URL(link.href);
    const state = articleState();
    for (const key of ['q', 'category']) if (state[key]) url.searchParams.set(`theory_${key}`, state[key]);
    link.href = url.href;
  });
}
if (search) {
  document.querySelector('.essay-filters').hidden = false;
  const category = document.getElementById('essay-category');
  const cards = [...document.querySelectorAll('.essay-card')];
  const normalize = s => s.normalize('NFKC').toLowerCase().replace(/[ぁ-ゖ]/g, c => String.fromCharCode(c.charCodeAt(0) + 96));
  const filter = (updateUrl = true) => {
    const words = normalize(search.value).trim().split(/\s+/).filter(Boolean);
    let count = 0;
    cards.forEach(card => {
      card.hidden = Boolean(category.value && card.dataset.category !== category.value) || !words.every(w => normalize(`${card.textContent} ${card.dataset.keywords || ''}`).includes(w));
      if (!card.hidden) count++;
    });
    document.getElementById('essay-count').textContent = `${count}本の記事`;
    document.getElementById('essay-empty').hidden = count !== 0;
    const state = {q: search.value, category: category.value};
    if (updateUrl) {
      const url = new URL(location.href);
      for (const key of ['q', 'category']) {
        if (state[key]) url.searchParams.set(key, state[key]); else url.searchParams.delete(key);
      }
      history.replaceState(history.state, '', url);
    }
    cards.forEach(card => carryState(card.querySelector('a'), state));
  };
  const restore = () => {
    const state = articleState(); search.value = state.q;
    category.value = [...category.options].some(option => option.value === state.category) ? state.category : '';
    filter(false);
  };
  search.addEventListener('input', () => filter());
  category.addEventListener('change', () => filter());
  window.addEventListener('popstate', restore);
  window.addEventListener('pageshow', restore);
  restore();
}
