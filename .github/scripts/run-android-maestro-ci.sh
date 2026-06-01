#!/usr/bin/env bash
set -euo pipefail

mkdir -p test-results

wait_for_ready_device() {
  adb wait-for-device
  for _ in $(seq 1 30); do
    state="$(adb get-state 2>/dev/null || true)"
    boot="$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r' || true)"
    if [ "$state" = "device" ] && [ "$boot" = "1" ]; then
      return 0
    fi
    sleep 1
  done

  echo "Android device did not become ready. adb devices:" >&2
  adb devices -l >&2 || true
  return 1
}

wait_for_ready_device
adb install -r -d apps/expo/build/PackRat.apk
wait_for_ready_device
adb shell pm path "$APP_ID"
adb shell monkey -p "$APP_ID" -c android.intent.category.LAUNCHER 1
wait_for_ready_device
adb shell input keyevent KEYCODE_BACK 2>/dev/null || true
adb shell input keyevent KEYCODE_BACK 2>/dev/null || true
bash .github/scripts/e2e.sh android --format junit --output test-results/maestro-results.xml
