/* Shared candidate picker. Values are rendered as text, never as HTML. */
(function(root) {
  'use strict';
  const fields={memo:'メモ',edits:'内容の編集',title:'題名',createdRecord:'追加した出来事'};
  const labels={description:'出来事',day:'日',time_start:'確定時刻',time_estimate:'推測時刻',time_end:'終了時刻',
    location:'場所',room:'部屋・現在地',type:'種別',notes:'備考',status:'状態',role:'役割',nen_ability:'念能力',
    appearance:'外見',nen_type:'念系統',ability:'能力',id:'識別子',chapter:'話数',chapter_order:'同じ話の中の順序',
    chapter_title:'話の題名',characters:'関係人物',date_certainty:'日付の確度',time_inference:'時計の補間',
    local_created:'個人で追加',is_estimate:'推測',chronology_kind:'記録の区分',revealed_facts:'判明した事実',mysteries:'疑問'};
  function preview(choice) {
    if (!choice.present) return '（この項目なし）';
    const value=choice.value;
    if (typeof value==='string') return value || '（空欄）';
    if (!Object.keys(value).length) return '（編集なし）';
    return Object.entries(value).map(([key,item])=>`${labels[key] || key}：${item==null || item===''?'未設定':
      typeof item==='object'?JSON.stringify(item,null,2):String(item)}`).join('\n');
  }
  function render(container,{getItem,onResolve}) {
    const document=container.ownerDocument;
    container.classList.add('draft-conflicts');
    container.setAttribute('aria-label','保存内容の競合');
    let busy=false;
    function draw(message='') {
      container.replaceChildren();
      const conflicts=getItem()?.conflicts || {};
      container.hidden=!Object.keys(conflicts).length && !message;
      if (Object.keys(conflicts).length) {
        const title=document.createElement('h5');title.textContent='同時刻の編集を両方残しています';
        const help=document.createElement('p');
        help.textContent='採用する案を選んでください。本文を変更して保存した場合も、その欄は新しい内容に決まります。内容を変えずに保存するだけでは候補は消えません。';
        container.append(title,help);
        for (const [field,choices] of Object.entries(conflicts)) {
          const group=document.createElement('fieldset');group.dataset.conflictField=field;
          const legend=document.createElement('legend');legend.textContent=fields[field] || field;group.appendChild(legend);
          choices.forEach((choice,index)=>{
            const option=document.createElement('div');option.className='draft-conflict-choice';
            const caption=document.createElement('strong');caption.textContent=`案${index+1}`;
            const text=document.createElement('pre');text.textContent=preview(choice);
            const button=document.createElement('button');button.type='button';button.textContent='この案を使う';
            button.setAttribute('aria-label',`${fields[field] || field}の案${index+1}を使う`);
            button.addEventListener('click',async()=>{
              if (busy) return;
              busy=true;container.querySelectorAll('button').forEach(node=>{node.disabled=true;});
              try {await onResolve(field,choice,choices);draw('選んだ内容を保存しました。');}
              catch(error) {draw(error.message || '保存できませんでした。候補は残しています。');}
              finally {busy=false;}
            });
            option.append(caption,text,button);group.appendChild(option);
          });
          container.appendChild(group);
        }
      }
      const status=document.createElement('p');status.className='draft-conflict-status';status.setAttribute('role','status');
      status.textContent=message;container.appendChild(status);
    }
    draw();
    return draw;
  }
  const api={render,preview};
  if (typeof module!=='undefined' && module.exports) module.exports=api;
  root.DraftConflicts=api;
})(typeof window==='undefined'?globalThis:window);
