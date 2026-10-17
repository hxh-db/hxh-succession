(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TheorySearch = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  const normalize = value => String(value || '').normalize('NFKC').toLowerCase()
    .replace(/[ぁ-ゖ]/g, c => String.fromCharCode(c.charCodeAt(0) + 96))
    .replace(/[\s・･＝=ー―‐‑–—－\-]/g, '');
  function rank(query, topic, references) {
    const words = String(query || '').trim().split(/\s+/).map(normalize).filter(Boolean);
    if (!words.length) return 0;
    const primary = normalize(topic), secondary = normalize(references);
    if (words.every(word => primary.includes(word))) return 0;
    return words.every(word => primary.includes(word) || secondary.includes(word)) ? 1 : Infinity;
  }
  return {normalize, rank};
});
