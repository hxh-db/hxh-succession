/* Shared spoiler preference is read, never changed by opening one article. */
function refreshArticleTitle() {
  const heading=document.querySelector('.spoiler-article .essay-title');
  if(heading) document.title=`${heading.closest('.spoiler-article').open ? heading.textContent : '考察記事'} | 王位継承戦データまとめ`;
}
function isSameTabLinkClick(event, link) {
  return !event.defaultPrevented && event.button === 0 && !event.ctrlKey && !event.metaKey
    && !event.shiftKey && !event.altKey && !link.hasAttribute('download')
    && (!link.target || link.target.toLowerCase() === '_self');
}
const theorySpoilerControl = (() => {
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
  window.addEventListener('storage',event=>{if([SpoilerPreferences.STORAGE_KEY,SpoilerPreferences.ACTION_KEY].includes(event.key))update(SpoilerPreferences.read(),false);});
  return {sync:()=>update(SpoilerPreferences.read(),false)};
})();
// Deep links never disclose a closed article. After an explicit open, resolve
// the requested section without changing the shared preference.
(() => {
  const article=document.querySelector('.spoiler-article .essay-title')?.closest('.spoiler-article');
  if(!article)return;
  const folds = [article, ...article.querySelectorAll('details')];
  const summaryFor = fold => fold?.querySelector(':scope > summary');
  const evidenceLinks = [...article.querySelectorAll('a[href*="event="]')];
  const savedReading = () => {
    const saved = history.state?.theoryEvidenceReading;
    return saved?.url === location.href ? saved : null;
  };
  const stateWithoutReading = () => {
    const state = {...history.state};
    delete state.theoryEvidenceReading;
    return state;
  };
  let focusOnOpen=false;
  const findSection=fragment=>[...article.querySelectorAll('[data-section]')].find(node=>node.dataset.section===fragment);
  const followFragment=(focus=false)=>{
    if(!article.open)return;
    let fragment;try{fragment=decodeURIComponent(location.hash.slice(1));}catch(_){return;}
    const target=findSection(fragment);if(!target)return;
    if(target.tagName==='DETAILS')target.open=true;
    requestAnimationFrame(()=>{
      if(!article.open)return;
      target.scrollIntoView({block:'start'});
      if(focus){
        const destination=target.tagName==='DETAILS' ? target.querySelector(':scope > summary') : target;
        if(destination && destination.tagName!=='SUMMARY')destination.tabIndex=-1;
        destination?.focus({preventScroll:true});
      }
    });
  };
  const restoreView = () => {
    const saved = savedReading();
    if (!saved) {
      followFragment(true);
      return;
    }

    const revealed = SpoilerPreferences.read();
    const samePreference = saved.revealed === revealed && saved.revision === SpoilerPreferences.revision();
    theorySpoilerControl?.sync();
    if (samePreference || revealed) {
      folds.forEach((fold, index) => { fold.open = Boolean(saved.openFolds[index]); });
      if (!samePreference) article.open = true;
    }
    refreshArticleTitle();
    requestAnimationFrame(() => {
      const link = evidenceLinks.find(candidate => candidate.href === saved.link);
      if (article.open && link?.checkVisibility()) {
        link.focus({preventScroll:true});
        window.scrollTo({top:saved.scrollY,behavior:'instant'});
        return;
      }
      const manualSummary = summaryFor(folds[saved.summaryIndex]);
      const summary = manualSummary?.checkVisibility() ? manualSummary : summaryFor(article);
      summary.focus({preventScroll:true});
      summary.scrollIntoView({block:'center',behavior:'instant'});
    });
  };

  evidenceLinks.forEach(link => link.addEventListener('click', event => {
    if (!article.open || !isSameTabLinkClick(event, link)) return;
    link.focus({preventScroll:true});
    history.scrollRestoration = 'manual';
    history.replaceState({...history.state, theoryEvidenceReading:{
      url:location.href, link:link.href, scrollY:window.scrollY, openFolds:folds.map(fold => fold.open),
      revealed:SpoilerPreferences.read(), revision:SpoilerPreferences.revision()
    }}, '', location.href);
  }));

  folds.forEach((fold, summaryIndex) => summaryFor(fold)?.addEventListener('click', event => {
    if (event.defaultPrevented) return;
    if (fold === article && !article.open) {
      focusOnOpen = true;
      history.replaceState(stateWithoutReading(), '', location.href);
      history.scrollRestoration = 'auto';
      return;
    }
    const saved = savedReading();
    if (!saved) return;
    const openFolds = folds.map(item => item === fold ? !item.open : item.open);
    history.replaceState({...history.state, theoryEvidenceReading:{...saved, link:null, openFolds, summaryIndex,
      revealed:SpoilerPreferences.read(), revision:SpoilerPreferences.revision()
    }}, '', location.href);
  }));

  article.addEventListener('toggle',()=>{
    refreshArticleTitle();
    const focus = focusOnOpen;
    focusOnOpen = false;
    if (!savedReading()) followFragment(focus);
  });
  article.querySelectorAll('a[href^="#"]').forEach(link=>link.addEventListener('click',event=>{
    if (!isSameTabLinkClick(event, link)) return;
    const url=new URL(link.href);if(!findSection(url.hash.slice(1)))return;
    event.preventDefault();
    if (url.href!==location.href) history.pushState(stateWithoutReading(),'',url.href);
    else if (savedReading()) history.replaceState(stateWithoutReading(),'',url.href);
    history.scrollRestoration = 'auto';
    followFragment(true);
  }));
  window.addEventListener('hashchange',restoreView);
  window.addEventListener('popstate',restoreView);
  // Resolve the initial target after the browser's native fragment navigation.
  // Otherwise its later focus/scroll can undo the destination set by the script.
  window.addEventListener('pageshow',restoreView);
  refreshArticleTitle();if(document.readyState==='complete')restoreView();
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
  const directory=search.closest('.spoiler-directory');
  const clearReadingState=()=>{const state={...history.state};delete state.theoryDirectoryReading;return state;};
  directory.querySelector(':scope > summary').addEventListener('click',()=>history.replaceState(clearReadingState(),'',location.href));
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
    const empty=document.getElementById('essay-empty');
    empty.hidden = count !== 0;
    empty.textContent=readThrough.value && !cards.some(card=>Number(card.dataset.chapter)<=Number(readThrough.value))
      ? `第${readThrough.value}話までを対象にした記事はまだありません。`
      : '該当する記事はありません。検索語や分類を変えてください。';
    const state = {q: search.value, category: category.value, read: readThrough.value};
    if (updateUrl) {
      const url = new URL(location.href);
      for (const key of ['q', 'category', 'read']) {
        if (state[key]) url.searchParams.set(key, state[key]); else url.searchParams.delete(key);
      }
      history.replaceState(clearReadingState(), '', url);
    }
    cards.forEach(card => carryState(card.querySelector('a'), state));
  };
  const restore = () => {
    const state = articleState(); search.value = state.q;
    category.value = [...category.options].some(option => option.value === state.category) ? state.category : '';
    readThrough.value = [...readThrough.options].some(option => option.value === state.read) ? state.read : '';
    filter(false);
    theorySpoilerControl?.sync();
    const saved=history.state?.theoryDirectoryReading;
    if(!saved || saved.url!==location.href)return;
    const samePreference=saved.revealed===SpoilerPreferences.read() && saved.revision===SpoilerPreferences.revision();
    directory.open=SpoilerPreferences.read() || (samePreference && saved.open);
    requestAnimationFrame(()=>{
      const link=cards.map(card=>card.querySelector('a')).find(link=>link.href===saved.link && !link.closest('.essay-card').hidden);
      if(directory.open && link){
        link.focus({preventScroll:true});
        window.scrollTo({top:Number.isFinite(saved.scrollY)?saved.scrollY:0,behavior:'instant'});
      }else{
        const summary=directory.querySelector(':scope > summary');
        summary.focus({preventScroll:true});summary.scrollIntoView({block:'center',behavior:'instant'});
      }
    });
  };
  cards.forEach(card=>{
    const link=card.querySelector('a');
    link.addEventListener('click',event=>{
      if (!isSameTabLinkClick(event, link)) return;
      link.focus({preventScroll:true});
      history.scrollRestoration='manual';
      history.replaceState({...history.state,theoryDirectoryReading:{url:location.href,link:link.href,scrollY:scrollY,
        open:directory.open,revealed:SpoilerPreferences.read(),revision:SpoilerPreferences.revision()}},'',location.href);
    });
  });
  search.addEventListener('input', () => filter());
  category.addEventListener('change', () => filter());
  readThrough.addEventListener('change', () => filter());
  window.addEventListener('popstate', restore);
  window.addEventListener('pageshow', restore);
  restore();
}
