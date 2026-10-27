/* Search public scene text and participant names; never inherit a person's later facts. */
(function(root,factory) {
  const facts=typeof module==='object' && module.exports?require('./character-facts.js'):root.CharacterFacts;
  const api=factory(facts);
  if(typeof module==='object' && module.exports) module.exports=api;
  else root.EventSearch=api;
})(typeof window==='undefined'?globalThis:window,function(facts) {
  function createIndex(events,people,{formatText=value=>String(value ?? ''),locationLabel=event=>event.location || event.room || ''}={}) {
    const names=new Map(people.map(person=>{
      const labels=[person.name,person.display_name,...(person.aliases || []),...facts.royalAliases(person)].filter(Boolean);
      return [person.id,[...labels,...labels.map(facts.katakanaToRomaji)]];
    }));
    const textByEvent=new WeakMap();
    for(const event of events) {
      const fields=[event.id,`第${event.chapter}話`,event.title,event.summary,event.description,event.notes,
        event.type,event.series,event.location,event.room,locationLabel(event),
        ...(event.revealed_facts || []),...(event.mysteries || []),
        ...(event.characters || []).flatMap(token=>names.get(token) || [token])];
      textByEvent.set(event,facts.buildSearchText(fields.filter(value=>value!=null).map(formatText)));
    }
    return {matcher(query) {
      const patterns=facts.searchPatterns(query);
      return event=>patterns.every(pattern=>pattern.test(textByEvent.get(event) || ''));
    }};
  }
  return {createIndex};
});
