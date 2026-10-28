/* Background list + character modal navigation; direct requests use static HTML. */
window.CharacterRoutes = (() => {
  let callbacks, active = false, replaying = false, closing = false, returnFocus = null, listUrl, listState, focusKey = 0, focusSequence = 0;
  const focusTargets = new Map();
  function modalState(id, title) {
    return {hxhCharacterModal:true,characterId:id,characterTitle:title,
      characterContext:{listUrl,listState,focusKey}};
  }
  function setup(options) {
    callbacks = options;
    history.scrollRestoration = "manual";
    window.addEventListener("popstate", () => {
      closing = false;
      const state = history.state;
      if (state?.hxhCharacterModal && callbacks.getPerson(state.characterId)) {
        if (state.characterContext) {
          ({listUrl,listState,focusKey} = state.characterContext);
          returnFocus = focusTargets.get(focusKey) || null;
        }
        active = true; replaying = true;
        try {
          if (state.personReading) callbacks.restoreList?.(listUrl,listState);
          callbacks.open(state.characterId,state.personReading);
        } finally { replaying = false; }
        document.title = state.characterTitle;
      } else if (active) {
        const personId = listState?.returnCharacterId;
        active = false;
        callbacks.close();
        if (state?.backgroundDetail) callbacks.restoreBackground?.(state.backgroundDetail, personId);
        else if (state?.hxhReading && !state.hxhCharacterList) callbacks.restoreReading?.(state);
        if (state?.hxhCharacterList) {
          document.title = state.listTitle;
          requestAnimationFrame(() => {
            if (returnFocus && document.contains(returnFocus)) returnFocus.focus({preventScroll:true});
            else if (!state.backgroundDetail) callbacks.restoreListFocus?.(personId);
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
      for (const [key,target] of focusTargets) if (!document.contains(target)) focusTargets.delete(key);
      focusKey = [...focusTargets].find(([,target])=>target===returnFocus)?.[0] || ++focusSequence;
      focusTargets.set(focusKey,returnFocus);
      listUrl = location.href;
      // A reload can retain a modal's history state. Keep its underlying list
      // state, rather than nesting the character context inside itself.
      const backgroundState = {...history.state};
      for (const key of ['hxhCharacterModal','characterId','characterTitle','characterContext','personReading']) delete backgroundState[key];
      listState = {...backgroundState,hxhCharacterList:true,scrollY:window.scrollY,listTitle:document.title,
        backgroundDetail:callbacks.captureBackground?.() || null,returnCharacterId:id};
      history.replaceState(listState,"",listUrl);
      history.pushState(modalState(id,title),"",url.href);
    } else {
      history.replaceState(modalState(id,title),"",url.href);
    }
    active = true; document.title = title;
  }
  function requestClose() {
    if (replaying || (!active && !callbacks?.canReturnToPerson?.())) return false;
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
  function suspendForEvent(snapshot) {
    if (!active || replaying) return false;
    history.replaceState({...history.state,personReading:snapshot},"",location.href);
    active = false;
    document.title = listState?.listTitle || document.title;
    return true;
  }
  return {setup,open,requestClose,prepareReload,suspendForEvent,isActive:()=>active,background:()=>active ? listState?.backgroundDetail : null};
})();
