/* Static-page enhancement only. HTML stays readable without JavaScript. */
(() => {
  const key = "hxh-succession-spoilers-revealed-v1";
  const button = document.getElementById("pageSpoilerToggle");
  const details = document.querySelector(".character-page-spoilers");
  const status = document.getElementById("pageSpoilerStatus");
  if (!button || !details) return;
  let revealed = false;
  try { revealed = localStorage.getItem(key) === "true"; } catch (_) { /* private browser mode */ }
  const update = (value, persist = true) => {
    revealed = value; details.open = value;
    button.textContent = value ? "ネタバレを隠す" : "ネタバレを表示";
    button.setAttribute("aria-pressed", String(value));
    status.textContent = value ? "共通設定：ネタバレを表示しています" : "共通設定：ネタバレを隠しています";
    if (persist) try { localStorage.setItem(key, String(value)); } catch (_) { /* no storage */ }
  };
  button.hidden = false; update(revealed, false);
  button.addEventListener("click", () => update(!revealed));
  details.addEventListener("toggle", () => { if (details.open !== revealed) update(details.open); });
  window.addEventListener("storage", event => { if (event.key === key) update(event.newValue === "true", false); });
})();
