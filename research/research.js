/* Search only neutral titles and explicit editorial keywords, never hidden body text. */
(() => {
  const byId = id => document.getElementById(id);
  const search = byId('research-search');
  const category = byId('research-category');
  const status = byId('research-status');
  const read = byId('research-read');
  const cards = [...document.querySelectorAll('.research-card')];
  const filter = (updateUrl = true) => {
    let count = 0;
    cards.forEach(card => {
      card.hidden = (category.value && card.dataset.category !== category.value)
        || (status.value && card.dataset.status !== status.value)
        || (read.value && Number(card.dataset.chapter) > Number(read.value))
        || !Number.isFinite(TheorySearch.rank(search.value, card.dataset.keywords, ''));
      if (!card.hidden) count++;
    });
    byId('research-count').textContent = `${count}件の調査項目`;
    byId('research-empty').hidden = count !== 0;
    if (updateUrl) {
      const url = new URL(location.href);
      for (const [key, input] of Object.entries({q: search, category, status, read})) {
        if (input.value) url.searchParams.set(key, input.value);
        else url.searchParams.delete(key);
      }
      history.replaceState(history.state, '', url);
    }
  };
  const restore = () => {
    const params = new URL(location.href).searchParams;
    for (const [key, input] of Object.entries({q: search, category, status, read})) {
      input.value = params.get(key) || '';
    }
    filter(false);
    const target = cards.find(card => `#${card.id}` === location.hash);
    if (target && !target.hidden) target.scrollIntoView();
  };
  search.addEventListener('input', () => filter());
  [category, status, read].forEach(input => input.addEventListener('change', () => filter()));
  window.addEventListener('popstate', restore);
  window.addEventListener('pageshow', restore);
  byId('research-filters').hidden = false;
  restore();
})();
