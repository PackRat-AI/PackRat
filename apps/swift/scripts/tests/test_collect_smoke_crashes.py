import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('collector', Path(__file__).parents[1] / 'collect-smoke-crashes.py')
collector = importlib.util.module_from_spec(spec)
spec.loader.exec_module(collector)


def fixture(name='PackRat'):
    return json.dumps({'app_name': name, 'timestamp': '2026-10-29', 'private': 'SECRET'}) + '\n' + json.dumps({
        'procName': name, 'pid': 42, 'exception': {'type': 'EXC_CRASH', 'signal': 'SIGABRT', 'memory': 'SECRET'},
        'termination': {'namespace': 'SIGNAL', 'code': 6}, 'environment': {'PASSWORD': 'SECRET'},
        'asi': {'payload': 'SECRET'}, 'threads': [{'triggered': True, 'registers': 'SECRET',
            'frames': [{'symbol': 'abort', 'imageIndex': 0, 'imageOffset': 17, 'memory': 'SECRET'}]}],
        'usedImages': [{'name': 'PackRat', 'path': '/Users/alice/Library/PackRat', 'uuid': 'image-id'}],
    })


class CrashCollectorTests(unittest.TestCase):
    def test_keeps_actionable_stack_without_raw_payloads(self):
        report = collector.sanitize_report(fixture())
        self.assertEqual(report['exception'], {'type': 'EXC_CRASH', 'signal': 'SIGABRT'})
        self.assertEqual(report['threads'][0]['frames'], [{'symbol': 'abort', 'imageIndex': 0, 'imageOffset': 17}])
        self.assertNotIn('SECRET', json.dumps(report))
        self.assertEqual(report['usedImages'][0]['path'], '/Users/[user]/Library/PackRat')

    def test_accepts_ios_executable_name(self):
        self.assertEqual(collector.sanitize_report(fixture('PackRat-iOS'))['process']['procName'], 'PackRat-iOS')

    def test_rejects_other_process_and_runner(self):
        for name in ['OtherApp', 'PackRatUITests-Runner']:
            self.assertIsNone(collector.sanitize_report(fixture(name)))

    def test_scrubs_urls_email_and_bearer(self):
        value = collector.scrub('https://example.test/?token=secret alice@example.test Bearer secret')
        self.assertEqual(value, '[url] [email] Bearer [redacted]')

    def test_current_run_only_and_malformed_report(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            marker = root / 'started'
            marker.touch()
            old = root / 'PackRat-old.ips'
            old.write_text(fixture())
            os.utime(old, (1, 1))
            (root / 'PackRat-current.ips').write_text(fixture())
            (root / 'PackRat-other.ips').write_text(fixture('OtherApp'))
            (root / 'PackRat-invalid.ips').write_text('invalid')
            output = root / 'output'
            counts = collector.collect([root, root], marker, output)
            self.assertEqual(counts, {'saved': 1, 'unreadable': 1, 'ignored': 1})
            self.assertEqual(len(list(output.glob('PackRat-crash-*.json'))), 1)


if __name__ == '__main__':
    unittest.main()
