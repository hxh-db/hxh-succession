import json
import unittest
from pathlib import Path
from validate_data import validate_character_evidence


class CharacterEvidenceTests(unittest.TestCase):
    def setUp(self):
        root = Path(__file__).resolve().parents[1]
        self.people = json.loads((root / 'data/characters.json').read_text(encoding='utf-8'))
        self.events = json.loads((root / 'data/events.json').read_text(encoding='utf-8'))

    def test_current(self):
        self.assertEqual(validate_character_evidence(self.people, self.events), [])

    def test_missing_claim_event(self):
        next(p for p in self.people if p['id'] == 'P14')['review_claims'][0]['event_ids'] = ['missing']
        self.assertTrue(any('確認情報' in e for e in validate_character_evidence(self.people, self.events)))

    def test_wrong_status_chapter(self):
        next(p for p in self.people if p['id'] == 'P14-P05')['status_log'][0]['chapter'] = None
        self.assertTrue(any('状態履歴' in e for e in validate_character_evidence(self.people, self.events)))

    def test_missing_other_victim_log(self):
        next(p for p in self.people if p['id'] == 'P14-P05')['status_log'] = []
        self.assertTrue(any('同一事件の死亡履歴' in e for e in validate_character_evidence(self.people, self.events)))

    def test_invalid_presence_person(self):
        self.events[0]['character_presence'] = {'missing':'present'}
        self.assertTrue(any('所在区分' in e for e in validate_character_evidence(self.people, self.events)))

    def test_missing_mystery_reference(self):
        self.events[0]['mysteries'] = ['test']
        self.events[0]['mystery_updates'] = [{'text':'test', 'status':'resolved', 'related_event_ids':['missing']}]
        self.assertTrue(any('疑問の確認記録の参照切れ' in e for e in validate_character_evidence(self.people, self.events)))

    def test_mismatched_mystery_text(self):
        self.events[0]['mystery_updates'] = [{'text':'missing', 'status':'open', 'related_event_ids':[self.events[0]['id']]}]
        self.assertTrue(any('疑問の更新対象' in e for e in validate_character_evidence(self.people, self.events)))


if __name__ == '__main__':
    unittest.main()
