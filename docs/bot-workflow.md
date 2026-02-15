# Bot Workflow Specification

## Overview
Defines how swarm bots (Abba, Bisque, Pinchy) coordinate via SwarmBoard JSON.

## Status Flow

```
backlog → in_progress → review → done
```

## Rules

### Claiming Work
- Bot claims story → updates `status: "in_progress"`, `assignee: "<bot-name>"`
- Only one bot can claim at a time (server returns 409 if already claimed)

### Completing Work  
- Bot completes → updates `status: "review"`, leaves assignee
- Assignee clears but history preserved in comments

### QA Approval (Pinchy)
- Pinchy reviews → updates `status: "done"`
- Pinchy adds QA comment: "✅ QA approved"

### Unclaiming
- Bot can't finish → updates `status: "backlog"`, clears `assignee`
- Returns to pool for other bots

## Coordination

### Handoffs
1. Bot A completes → sets `status: "review"`
2. Bot A mentions next bot in comment: "@bot-name review please"
3. Pinchy QA approves → sets `status: "done"`

### Roll Call
- Respond with ✅ only (no other emojis)
- Keep it brief

## Example Flow

```json
// Bot claims story
{ "id": "story-001", "status": "in_progress", "assignee": "bisque" }

// Bot completes - needs review
{ "id": "story-001", "status": "review", "assignee": "bisque" }

// Pinchy QA approves
{ "id": "story-001", "status": "done", "assignee": null }
```

## API Endpoints (Local)
- `GET /stories` - list all
- `POST /stories/:id/claim` - claim (body: `{"assignee": "bot-name"}`)
- `POST /stories/:id/unclaim` - unclaim
- `PATCH /stories/:id` - update status/assignee
