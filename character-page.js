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
  const avatarReady = new WeakMap();
  let returnFocus = null;
  const open = (trigger) => {
    if (avatarReady.get(trigger) === false) return;
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
    if (trigger.matches?.(".character-page-avatar")) {
      // CSS crops have no error event. Probe their source, and also handle an
      // ordinary img that finished (or failed) before this deferred script ran.
      const source = trigger.dataset.zoomSrc;
      const href = trigger.getAttribute("href");
      const name = trigger.dataset.zoomAlt || "顔画像";
      const image = trigger.querySelector("img") || document.createElement("img");
      avatarReady.set(trigger, false);
      trigger.dataset.avatarState = "loading";
      trigger.removeAttribute("href");
      trigger.setAttribute("aria-disabled", "true");
      const failed = () => {
        trigger.dataset.avatarState = "error";
        trigger.classList.remove("zoomable-image");
        for (const attribute of ["href", "role", "tabindex", "aria-disabled", "data-zoom-src", "data-zoom-alt", "data-zoom-caption"]) trigger.removeAttribute(attribute);
        trigger.textContent = (document.querySelector("h1")?.textContent || name).slice(0, 2);
        trigger.style.cssText += ";display:grid;place-items:center;color:#172b4d;font-size:1.5rem;font-weight:bold";
        trigger.setAttribute("role", "img");
        trigger.setAttribute("aria-label", `${name}を読み込めませんでした`);
        trigger.title = `${name}を読み込めませんでした`;
      };
      const loaded = () => {
        if (!image.naturalWidth) { failed(); return; }
        avatarReady.set(trigger, true);
        trigger.dataset.avatarState = "ready";
        trigger.setAttribute("href", href);
        trigger.removeAttribute("aria-disabled");
        trigger.setAttribute("role", "button");
      };
      image.addEventListener("load", loaded);
      image.addEventListener("error", failed);
      if (!image.getAttribute("src")) image.src = source;
      else if (image.complete) loaded();
    } else trigger.setAttribute("role", "button");
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
