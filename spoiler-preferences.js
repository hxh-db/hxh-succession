/* Two supported disclosure levels. Chapter-specific disclosure is not yet enabled. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SpoilerPreferences=api;})(typeof globalThis==='object'?globalThis:this,function(){
  const STORAGE_KEY='hxh-succession-spoilers-revealed-v1';
  function read(storage){try{return (storage || globalThis.localStorage).getItem(STORAGE_KEY)==='true';}catch(_){return false;}}
  function mount(container,{latestChapter,onChange}){
    const label=document.createElement('label');label.className='spoiler-range-label';
    label.appendChild(document.createTextNode('ネタバレ表示範囲'));
    const select=document.createElement('select');select.id='spoilerRange';select.className='spoiler-range-select';
    const chapter=Number.isInteger(latestChapter)&&latestChapter>0?`（第${latestChapter}話まで）`:'';
    for(const [value,text] of [['basic','基本情報のみ'],['all',`収録済み全情報${chapter}`]]){
      const option=document.createElement('option');option.value=value;option.textContent=text;select.appendChild(option);
    }
    const help=document.createElement('span');help.id='spoilerRangeHelp';help.className='spoiler-range-help';
    help.textContent='読み終えた範囲を選んでください。現在は基本情報／収録済み全情報の2段階です。';
    select.setAttribute('aria-describedby',help.id);label.appendChild(select);container.replaceChildren(label,help);
    container.hidden=false;select.addEventListener('change',()=>onChange(select.value==='all'));
    return {setValue(revealed){select.value=revealed?'all':'basic';}};
  }
  return {STORAGE_KEY,read,mount};
});
