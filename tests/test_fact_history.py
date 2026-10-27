import unittest
from validate_data import validate_fact_history


class FactHistoryReferences(unittest.TestCase):
    events = [dict(id='proof', chapter=400, characters=['child']),dict(id='future', chapter=415, characters=['child'])]

    def check_values(self, chapter=400, sources=None, values=None):
        return validate_fact_history([dict(id='child', fact_history=[dict(chapter=chapter,source_event_ids=sources or ['proof'],values=values or dict(parent_ids=['parent']))]),dict(id='parent')],self.events)

    def test_confirmed_relationship(self):
        self.assertEqual(self.check_values(), [])

    def test_future_or_missing_evidence(self):
        for sources in [['future'],['missing']]:
            self.assertTrue(self.check_values(sources=sources))
        self.assertTrue(self.check_values(chapter=401))
        self.assertTrue(validate_fact_history([dict(id='other',fact_history=[dict(chapter=400,source_event_ids=['proof'],values=dict(role='警護兵'))])],self.events))

    def test_duplicate_or_reversed_reveal_chapters(self):
        entry = dict(chapter=400,source_event_ids=['proof'],values=dict(role='警護兵'))
        later = dict(chapter=415,source_event_ids=['future'],values=dict(role=None))
        for entries in [[entry,entry],[later,entry]]:
            self.assertTrue(validate_fact_history([dict(id='child',fact_history=entries)],self.events))

    def test_invalid_relationships(self):
        for target in ['child','missing']:
            self.assertTrue(self.check_values(values=dict(parent_ids=[target])))
