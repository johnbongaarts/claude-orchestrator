# Compact Handoff: Memory System Enforcement

## Context
The claude-orchestrator memory system has SQLite infrastructure but captures nothing because it's opt-in. Workers can merge without ever recording learnings.

## What Exists (Branch: `feature/memory-system-upgrade`)
- SQLite + FTS5 memory database at `~/.claude/memory/memory.db`
- Domain classification: `frontend`, `backend`, `auth`, `database`, `testing`, `devops`, `docs`, `orchestrator`, `shared`
- Three tiers: `seed` (defaults), `user` (cross-project), `project` (project-specific)
- New observation types: `pattern`, `decision`, `handoff`
- API: `capturePattern()`, `captureDecision()`, `captureHandoff()`, `getDomainPatterns()`
- All 88 tests pass

## What Needs to Be Built

### 1. Lifecycle Hooks (automatic capture)
Create hook scripts that Claude Code calls automatically:
```bash
# ~/.claude/scripts/capture-tool-use.sh
# Called on PostToolUse - capture significant tool calls to memory

# ~/.claude/scripts/capture-session-end.sh
# Called on SessionEnd - generate handoff summary
```

Register in `~/.claude/settings.json`:
```json
{
  "hooks": {
    "PostToolUse": ["~/.claude/scripts/capture-tool-use.sh"],
    "SessionEnd": ["~/.claude/scripts/capture-session-end.sh"]
  }
}
```

### 2. Session-End Enforcement (gate merge on handoff)
In `src/worker-manager.ts`:
- Add `sessionEndCalled: boolean` to WorkerInstance
- Detect `/assistant session-end` in JSONL output

In `src/state-machine.ts`:
- Add `RETROSPECTIVE` state between `PR_OPEN` and `MERGING`

In `src/orchestrator.ts`:
- Block merge until `sessionEndCalled` is true
- Nudge workers: "Run /assistant session-end before merge"

### 3. Simplify Worker Training
Update `~/.claude/orchestrator/seed/worker-training-template.md`:
- Remove complex memory instructions
- Single requirement: "Run `/assistant session-end` when done"
- Hooks handle the rest

## Key Insight
claude-mem's approach works: **lifecycle hooks** capture automatically, removing cognitive burden from workers. Don't rely on workers remembering to call commands.

## Skip
Retrospector agent - adds cost without clear value if hooks + enforcement are in place. The worker knows the "why" behind decisions; an external agent can only extract surface patterns.

## Files to Modify
- `~/.claude/settings.json` - hook registration
- `src/worker-manager.ts:72` - add sessionEndCalled tracking
- `src/orchestrator.ts:411` - add enforcement in handleWorkerEvent
- `src/state-machine.ts` - add RETROSPECTIVE state
- `~/.claude/orchestrator/seed/worker-training-template.md` - simplify
