// Keep the six-record navigation scenario after the original scenes have been reviewed.
// This is test-only data: public events and their verification statuses remain unchanged.
function unreviewedMorenaLocations(events) {
  const anchor = events.find(event => event.id === 'E407-004');
  if (!anchor?.characters?.includes('EII-001')) throw new Error('Missing location scenario anchor');
  return events.map(event => event.characters?.includes('EII-001')
    ? {...event, character_presence: {...event.character_presence, 'EII-001': event === anchor ? 'present' : 'unknown'}}
    : event);
}
module.exports = {unreviewedMorenaLocations};
