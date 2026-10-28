/* Shared spoiler preference is read, never changed by opening one article. */
function refreshArticleTitle() {
  const heading=document.querySelector('.spoiler-article .essay-title');
  if(heading) document.title=`${heading.closest('.spoiler-article').open ? heading.textContent : '考察記事'} | 王位継承戦データまとめ`;
}
(() => {
  const container=document.getElementById('spoilerPreferences');
  if(!container)return;
  const update=(revealed,persist=true)=>{
    document.querySelectorAll('.spoiler-article,.spoiler-directory').forEach(el=>{el.open=revealed;});
    refreshArticleTitle();
    control.setValue(revealed);
    if(persist)try{localStorage.setItem(SpoilerPreferences.STORAGE_KEY,String(revealed));}catch(_){/* no storage */}
  };
  const control=SpoilerPreferences.mount(container,{latestChapter:Number(container.dataset.latestChapter),onChange:update});
  update(SpoilerPreferences.read(),false);
  window.addEventListener('storage',event=>{if(event.key===SpoilerPreferences.STORAGE_KEY)update(event.newValue==='true',false);});
})();
// Deep links never disclose a closed article. After an explicit open, resolve
// the requested section without changing the shared preference.
(() => {
  const article=document.querySelector('.spoiler-article .essay-title')?.closest('.spoiler-article');
  if(!article)return;
  const findSection=fragment=>[...article.querySelectorAll('[data-section]')].find(node=>node.dataset.section===fragment);
  const followFragment=()=>{
    if(!article.open)return;
    let fragment;try{fragment=decodeURIComponent(location.hash.slice(1));}catch(_){return;}
    const target=findSection(fragment);if(!target)return;
    if(target.tagName==='DETAILS')target.open=true;
    requestAnimationFrame(()=>target.scrollIntoView({block:'start'}));
  };
  article.addEventListener('toggle',()=>{refreshArticleTitle();followFragment();});
  article.querySelectorAll('a[href^="#"]').forEach(link=>link.addEventListener('click',event=>{
    const url=new URL(link.href);if(!findSection(url.hash.slice(1)))return;
    event.preventDefault();history.pushState(history.state,'',url.href);followFragment();
  }));
  window.addEventListener('hashchange',followFragment);
  window.addEventListener('popstate',followFragment);
  refreshArticleTitle();followFragment();
})();
const search = document.getElementById('essay-search');
const articleState = () => {
  const params = new URL(location.href).searchParams;
  return {q: params.get('q') || '', category: params.get('category') || '', read: params.get('read') || ''};
};
const carryState = (link, state) => {
  const url = new URL(link.getAttribute('href'), location.href);
  for (const key of ['q', 'category', 'read']) {
    if (state[key]) url.searchParams.set(key, state[key]);
    else url.searchParams.delete(key);
  }
  link.href = url.href;
};
// URLだけで復元できるよう、一覧へのリンク・関連記事にも条件を渡す。
if (!search) {
  document.querySelectorAll('main a[href="../"], main a[href^="../Q"], main a[href^="../emperor-time/"]').forEach(link => carryState(link, articleState()));
  document.querySelectorAll('main a[href*="event="]').forEach(link => {
    const url = new URL(link.href);
    const state = articleState();
    for (const key of ['q', 'category', 'read']) if (state[key]) url.searchParams.set(`theory_${key}`, state[key]);
    link.href = url.href;
  });
}
if (search) {
  document.querySelector('.essay-filters').hidden = false;
  const category = document.getElementById('essay-category');
  const readThrough = document.getElementById('essay-read-through');
  const cards = [...document.querySelectorAll('.essay-card')];
  const topics = new Map(cards.map(card => [card, `${card.querySelector('h2').textContent} ${card.dataset.topicKeywords || ''}`]));
  const filter = (updateUrl = true) => {
    const ranks = new Map(cards.map(card => [card, TheorySearch.rank(search.value, topics.get(card), card.dataset.referenceKeywords)]));
    let count = 0;
    cards.forEach(card => {
      card.hidden = Boolean(category.value && card.dataset.category !== category.value)
        || Boolean(readThrough.value && Number(card.dataset.chapter) > Number(readThrough.value)) || !Number.isFinite(ranks.get(card));
      const reason = card.querySelector('.essay-match-reason');
      reason.hidden = !search.value.trim() || card.hidden;
      reason.textContent = ranks.get(card) === 0 ? '記事の主題に一致' : '参照場面に登場（主題外の関連人物を含む）';
      if (!card.hidden) count++;
    });
    cards.slice().sort((a,b) => ranks.get(a) - ranks.get(b) || cards.indexOf(a) - cards.indexOf(b))
      .forEach(card => card.parentElement.appendChild(card));
    document.getElementById('essay-count').textContent = `${count}本の記事`;
    document.getElementById('essay-empty').hidden = count !== 0;
    const state = {q: search.value, category: category.value, read: readThrough.value};
    if (updateUrl) {
      const url = new URL(location.href);
      for (const key of ['q', 'category', 'read']) {
        if (state[key]) url.searchParams.set(key, state[key]); else url.searchParams.delete(key);
      }
      history.replaceState(history.state, '', url);
    }
    cards.forEach(card => carryState(card.querySelector('a'), state));
  };
  const restore = () => {
    const state = articleState(); search.value = state.q;
    category.value = [...category.options].some(option => option.value === state.category) ? state.category : '';
    readThrough.value = [...readThrough.options].some(option => option.value === state.read) ? state.read : '';
    filter(false);
  };
  search.addEventListener('input', () => filter());
  category.addEventListener('change', () => filter());
  readThrough.addEventListener('change', () => filter());
  window.addEventListener('popstate', restore);
  window.addEventListener('pageshow', restore);
  restore();
}
