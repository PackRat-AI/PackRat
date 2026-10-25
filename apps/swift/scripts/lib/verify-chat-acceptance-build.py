"""Fail closed before launching the dedicated chat acceptance application."""
import pathlib
import plistlib
import sys


def verify(products):
    matches = []
    for app in pathlib.Path(products).glob('*.app'):
        info_path = app / 'Info.plist'
        with info_path.open('rb') as source:
            info = plistlib.load(source)
        if 'PACKRAT_ENV' not in info:
            continue  # XCTest runner, not the PackRat application.
        if info['PACKRAT_ENV'] != 'local':
            raise ValueError('Chat acceptance requires a local app build')
        for key in ('SENTRY_DSN', 'REVENUECAT_API_KEY'):
            if key not in info or info[key] != '':
                raise ValueError(f'Chat acceptance requires an explicitly empty {key}')
        matches.append(app)
    if len(matches) != 1:
        raise ValueError('Expected exactly one isolated PackRat application')
    print('Verified local app with telemetry and purchases disabled')


if __name__ == '__main__':
    try:
        verify(sys.argv[1])
    except (ValueError, OSError, plistlib.InvalidFileException, IndexError) as error:
        print(f'Chat acceptance preflight failed: {error}', file=sys.stderr)
        sys.exit(1)
