import contextlib
import copy
import io
import json
import runpy
import unittest
from pathlib import Path
from unittest.mock import patch

import validate_data

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / 'data'


class WebResearchTests(unittest.TestCase):
    def setUp(self):
        self.data = json.loads((BASE / 'web_research.json').read_text(encoding='utf-8'))

    def errors(self, mutate):
        data = copy.deepcopy(self.data)
        mutate(data)
        original_open = open

        def read(path, *args, **kwargs):
            if Path(path) == BASE / 'web_research.json':
                return io.StringIO(json.dumps(data, ensure_ascii=False))
            return original_open(path, *args, **kwargs)

        with patch('builtins.open', side_effect=read):
            return '\n'.join(validate_data.validate_cross_references(BASE))

    def test_schema_rejects_unlabeled_claims_and_invalid_status(self):
        schema = json.loads((BASE / 'web_research.schema.json').read_text(encoding='utf-8'))
        validator = validate_data.jsonschema.Draft7Validator(schema)
        self.assertEqual(list(validator.iter_errors(self.data)), [])
        for mutate in [lambda r: r.pop('assessment'), lambda r: r.update(status='canon'),
                       lambda r: r.update(source_ids=[])]:
            data = copy.deepcopy(self.data)
            mutate(data['entries'][0])
            self.assertTrue(list(validator.iter_errors(data)))

    def test_missing_references_and_duplicate_research_are_rejected(self):
        for field in ['source_ids', 'related_character_ids', 'related_event_ids', 'related_theory_ids']:
            with self.subTest(field=field):
                self.assertIn('Web調査の参照先がありません', self.errors(lambda d: d['entries'][0][field].append('MISSING')))
        self.assertIn('Web調査IDが重複', self.errors(lambda d: d['entries'].append(copy.deepcopy(d['entries'][0]))))

    def test_later_evidence_cannot_leak_into_earlier_scope(self):
        self.assertIn('Web調査の話数範囲を超える参照', self.errors(lambda d: d['entries'][0].update(related_event_ids=['E418-001'])))

    def test_secondary_names_do_not_create_confirmed_passengers(self):
        people = json.loads((BASE / 'characters.json').read_text(encoding='utf-8'))
        self.assertFalse({'エリックス', 'ムハハハサレ', 'ゾメーサ'} & {p['name'] for p in people})
        by_id = {p['id']: p for p in people}
        self.assertIsNone(by_id['P12-H01']['nen_type'])
        self.assertIn('未照合', by_id['P12-H01']['nen_type_detail'])
        self.assertIn('廻天', by_id['SPD-003']['nen_ability'])
        self.assertEqual(by_id['SPD-003']['ability_verification_status'], 'needs_original_review')

    def test_catalog_check_never_writes_and_reports_staleness(self):
        original_read = Path.read_text
        target = ROOT / 'research/index.html'
        for stale in [False, True]:
            def read(path, *args, **kwargs):
                return 'stale' if stale and path == target else original_read(path, *args, **kwargs)
            output = io.StringIO()
            with patch('sys.argv', ['build-web-research.py', '--check']), \
                    patch.object(Path, 'read_text', read), \
                    patch.object(Path, 'write_text', side_effect=AssertionError('check must not write')), \
                    contextlib.redirect_stdout(output):
                with self.assertRaises(SystemExit) as error:
                    runpy.run_path(str(ROOT / 'scripts/build-web-research.py'), run_name='__main__')
                self.assertEqual(error.exception.code, int(stale))
            self.assertIn('STALE:' if stale else 'PASS:', output.getvalue())


if __name__ == '__main__':
    unittest.main()
