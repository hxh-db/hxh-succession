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
    if (!value && document.getElementById("imageLightbox")?.open) document.getElementById("imageLightbox").close();
    if (persist) try { localStorage.setItem(key, String(value)); } catch (_) { /* no storage */ }
  };
  button.hidden = false; update(revealed, false);
  button.addEventListener("click", () => update(!revealed));
  // 折りたたみを手で開いても、全画面共通のネタバレ設定は変えない・保存しない（ボタンだけが共通設定を変える）。
  window.addEventListener("storage", event => { if (event.key === key) update(event.newValue === "true", false); });
})();
/* 顔画像の拡大表示。一覧（script.js の setupImageLightbox）と同じ見た目・操作の最小版。 */
(() => {
  const dialog = document.getElementById("imageLightbox");
  const enlarged = document.getElementById("lightboxImage");
  const caption = document.getElementById("lightboxCaption");
  const close = document.getElementById("lightboxClose");
  const zoom = document.getElementById("lightboxZoom");
  if (!dialog || !enlarged || !caption || !close || !zoom || typeof dialog.showModal !== "function") return;
  const triggers = document.querySelectorAll(".zoomable-image[data-zoom-src]");
  let returnFocus = null;
  const open = (trigger) => {
    returnFocus = trigger;
    enlarged.src = trigger.dataset.zoomSrc;
    enlarged.alt = trigger.dataset.zoomAlt || "拡大画像";
    caption.textContent = trigger.dataset.zoomCaption || "";
    dialog.classList.remove("magnified");
    zoom.setAttribute("aria-pressed", "false");
    zoom.textContent = "＋ さらに拡大";
    dialog.showModal();
    close.focus();
  };
  triggers.forEach((trigger) => {
    trigger.setAttribute("role", "button");
    trigger.addEventListener("click", (event) => { event.preventDefault(); open(trigger); });
    trigger.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      open(trigger);
    });
  });
  close.addEventListener("click", () => dialog.close());
  zoom.addEventListener("click", () => {
    const magnified = dialog.classList.toggle("magnified");
    zoom.setAttribute("aria-pressed", String(magnified));
    zoom.textContent = magnified ? "− 全体表示" : "＋ さらに拡大";
  });
  // Escape はダイアログ標準の cancel で閉じる。Tab は2つのボタンの間で循環させる。
  dialog.addEventListener("keydown", (event) => {
    if (event.key !== "Tab") return;
    const items = [zoom, close];
    const index = items.indexOf(document.activeElement);
    event.preventDefault();
    items[(index + (event.shiftKey ? items.length - 1 : 1)) % items.length].focus();
  });
  dialog.addEventListener("close", () => {
    enlarged.removeAttribute("src");
    returnFocus?.focus();
  });
})();
