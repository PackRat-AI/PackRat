#!/bin/bash
# Weather-alerts test monitor. Usage: wa-monitor.sh [state|tokens|watch|reset|alerts]
REG="$HOME/.packrat/devenv/worktree-weather-alerts-proactive.json"
export NEON_DATABASE_URL=$(bun -e "console.log(JSON.parse(require('fs').readFileSync('$REG','utf8')).databaseUrl)")
cd /Users/mac/Desktop/PackRat/.claude/worktrees/weather-alerts-proactive
case "${1:-state}" in
  state)  Q="SELECT weather_location_id, poll_tier, last_polled_at, active_since, last_alert_ids FROM weather_location_alert_state ORDER BY last_polled_at DESC" ;;
  tokens) Q="SELECT id, user_id, left(device_token,18)||'...' AS device_token, platform, created_at, last_seen_at FROM user_device_tokens ORDER BY created_at DESC" ;;
  watch)  Q="SELECT id, user_id, weather_location_id, location_name, region, lat, lon, created_at FROM weather_watched_locations ORDER BY created_at DESC" ;;
  reset)  Q="DELETE FROM weather_location_alert_state" ;;
  *) echo "usage: $0 [state|tokens|watch|reset]"; exit 1 ;;
esac
bun -e "
import {neon} from '@neondatabase/serverless';
const sql=neon(process.env.NEON_DATABASE_URL);
const r=await sql.query(\`$Q\`);
console.log(JSON.stringify(r,null,2));
"
