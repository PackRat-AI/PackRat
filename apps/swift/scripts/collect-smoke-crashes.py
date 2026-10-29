#!/usr/bin/env python3
"""Retain only current-run PackRat IPS crash metadata and symbolicated stacks.

Never copy raw reports: omit register/memory state, app-specific free-form
payloads, environment, arguments and unrelated processes. No network access.
"""
import argparse
import json
import re
from pathlib import Path


def scrub(value):
    if isinstance(value, str):
        value = re.sub(r"https?://[^\s\"<>]+", "[url]", value)
        value = re.sub(r"(?i)bearer\s+\S+", "Bearer [redacted]", value)
        value = re.sub(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}", "[email]", value)
        value = re.sub(r"/(Users|home)/[^/\s]+", r"/\1/[user]", value)
        return value
    if isinstance(value, list):
        return [scrub(item) for item in value]
    if isinstance(value, dict):
        return {key: scrub(item) for key, item in value.items()}
    return value


def select(value, keys):
    if not isinstance(value, dict):
        return {}
    return scrub({key: value[key] for key in keys if key in value})


def frames(value):
    if not isinstance(value, list):
        return []
    return [select(frame, ('imageIndex', 'imageOffset', 'symbol', 'symbolLocation'))
            for frame in value]


def sanitize_report(text):
    # Modern Apple IPS is a one-line JSON header followed by a JSON report.
    header, remainder = json.JSONDecoder().raw_decode(text.lstrip())
    report = json.loads(text.lstrip()[remainder:])
    if not isinstance(header, dict) or not isinstance(report, dict):
        return None
    app_names = {'PackRat', 'PackRat-iOS'}
    if report.get('procName') not in app_names or header.get('app_name') not in app_names:
        return None
    result = {
        'header': select(header, ('app_name', 'timestamp', 'bug_type', 'os_version', 'bundleID')),
        'process': select(report, ('procName', 'captureTime', 'procLaunch', 'pid', 'faultingThread')),
        'exception': select(report.get('exception'), ('type', 'signal', 'codes', 'rawCodes')),
        'termination': select(report.get('termination'), ('namespace', 'code', 'indicator')),
        'threads': [],
        'usedImages': [select(image, ('name', 'path', 'arch', 'base', 'size', 'uuid'))
                       for image in report.get('usedImages', [])],
        'lastExceptionBacktrace': frames(report.get('lastExceptionBacktrace')),
    }
    for thread in report.get('threads', []):
        item = select(thread, ('id', 'triggered', 'queue', 'name'))
        item['frames'] = frames(thread.get('frames'))
        result['threads'].append(item)
    return result


def collect(roots, marker, output):
    output.mkdir(parents=True, exist_ok=True)
    counts = {'saved': 0, 'unreadable': 0, 'ignored': 0}
    seen = set()
    for root in roots:
        if not root.is_dir():
            continue
        for path in root.rglob('PackRat*.ips'):
            if path.is_symlink() or path in seen:
                continue
            seen.add(path)
            try:
                if path.stat().st_mtime < marker.stat().st_mtime:
                    continue
                report = sanitize_report(path.read_text())
                if report is None:
                    counts['ignored'] += 1
                    continue
                counts['saved'] += 1
                name = f"PackRat-crash-{counts['saved']:03d}.json"
                (output / name).write_text(json.dumps(report, indent=2) + '\n')
                triggered = [t for t in report['threads'] if t.get('triggered')]
                # Bounded safe evidence in the job log, available even when
                # artifact retrieval is unavailable. Full filtered stacks attach.
                print(json.dumps({'file': name, 'process': report['process'],
                                  'exception': report['exception'],
                                  'termination': report['termination'],
                                  'triggeredFrames': [t['frames'][:12] for t in triggered]}))
            except (OSError, ValueError, TypeError, AttributeError):
                counts['unreadable'] += 1
    (output / 'collection-summary.json').write_text(json.dumps(counts) + '\n')
    print(json.dumps(counts))
    return counts


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', action='append', required=True, type=Path)
    parser.add_argument('--since', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    if not args.since.is_file():
        parser.error('Missing run marker; refusing to collect historical reports')
    collect(args.root, args.since, args.output)
