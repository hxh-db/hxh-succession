import unittest
from validate_data import validate_nen_history


class NenHistoryReferences(unittest.TestCase):
    events = [dict(id='E413-001', chapter=413, characters=['P01-P06']),
              dict(id='E415-001', chapter=415, characters=['P01-P06']),
              dict(id='E415-other', chapter=415, characters=['P14-H02'])]

    def check_entries(self, entries):
        return validate_nen_history([dict(id='P01-P06', nen_history=entries)], self.events)

    def test_reader_reveal_chapter_matches_sources(self):
        self.assertEqual(self.check_entries([dict(chapter=413, source_event_ids=['E413-001']),
                                             dict(chapter=415, source_event_ids=['E413-001', 'E415-001'])]), [])

    def test_cannot_borrow_future_or_another_persons_evidence(self):
        for chapter, sources in [(413, ['E415-001']), (415, ['E415-other']),
                                 (415, ['missing']), (415, ['E413-001'])]:
            with self.subTest(chapter=chapter, sources=sources):
                self.assertTrue(self.check_entries([dict(chapter=chapter, source_event_ids=sources)]))

    def test_no_duplicate_or_reversed_snapshots(self):
        first = dict(chapter=413, source_event_ids=['E413-001'])
        later = dict(chapter=415, source_event_ids=['E415-001'])
        self.assertTrue(self.check_entries([first, first]))
        self.assertTrue(self.check_entries([later, first]))
