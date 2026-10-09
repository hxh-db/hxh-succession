/* Background list + character modal navigation; direct requests use static HTML. */
window.CharacterRoutes = (() => {
  let callbacks, active = false, replaying = false, closing = false, returnFocus = null, listUrl, listState;
  function setup(options) {
    callbacks = options;
    history.scrollRestoration = "manual";
    window.addEventListener("popstate", () => {
      closing = false;
      const state = history.state;
      if (state?.hxhCharacterModal && callbacks.getPerson(state.characterId)) {
        active = true; replaying = true;
        try { callbacks.open(state.characterId); } finally { replaying = false; }
        document.title = state.characterTitle;
      } else if (active) {
        active = false;
        callbacks.close();
        if (state?.hxhCharacterList) {
          document.title = state.listTitle;
          requestAnimationFrame(() => {
            if (returnFocus && document.contains(returnFocus)) returnFocus.focus({preventScroll:true});
            window.scrollTo({top:state.scrollY,left:0,behavior:"instant"});
          });
        }
      }
    });
  }
  function open(id) {
    if (!callbacks || replaying) return;
    const person = callbacks.getPerson(id);
    if (!person) return;
    const url = new URL(`characters/${encodeURIComponent(id)}/`, callbacks.rootUrl);
    const title = `${person.display_name || person.name} | HUNTER×HUNTER 王位継承戦データベース`;
    if (!active) {
      returnFocus = document.activeElement;
      listUrl = location.href;
      listState = {...history.state,hxhCharacterList:true,scrollY:window.scrollY,listTitle:document.title};
      history.replaceState(listState,"",listUrl);
      history.pushState({hxhCharacterModal:true,characterId:id,characterTitle:title},"",url.href);
    } else {
      history.replaceState({hxhCharacterModal:true,characterId:id,characterTitle:title},"",url.href);
    }
    active = true; document.title = title;
  }
  function requestClose() {
    if (!active || replaying) return false;
    if (closing) return true;
    closing = true;
    history.back(); return true;
  }
  function prepareReload() {
    // Local edits reload the application, not the public static character page.
    if (!active || !listUrl) return;
    history.replaceState(listState,"",listUrl);
    document.title = listState.listTitle;
    active = false;
  }
  return {setup,open,requestClose,prepareReload,isActive:()=>active};
})();
