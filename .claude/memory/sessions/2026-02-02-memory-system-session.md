# Session Handoff: Memory System Upgrade

**Date**: 2026-02-02
**Branch**: `feature/memory-system-upgrade` (pushed to origin)
**Status**: Infrastructure complete, enforcement layer pending

---

## Problem Statement

The claude-orchestrator memory system was well-designed (three-tier architecture, domain classification) but **never captured anything** because:

1. **No enforcement** - Workers could merge without calling `/assistant remember` or `/assistant session-end`
2. **Manual capture friction** - Workers had to pause, formulate, execute memory commands
3. **No immediate reward** - Benefits accrue to future workers, not the current one
4. **Prompt dilution** - Memory instructions got lost in task context

### Root Cause
The system was entirely **opt-in**. Workers were trained but not forced. The orchestrator had zero verification that memory capture actually happened.

---

## What We Learned from Competitors

### Upstream v3.2.0 (reshashi/claude-orchestrator)
- Implemented SQLite + FTS5 memory system
- **Automatic event capture** (state changes, PR events, errors)
- Captures **what happened** (operations), not **what we learned** (patterns)
- No domain classification or three-tier support

### claude-mem (thedotmack)
- Key insight: **Lifecycle hooks** solve automatic capture
- Uses `PostToolUse`, `SessionEnd`, `SessionStart` hooks
- AI-powered compression for token efficiency
- Progressive disclosure (search → timeline → details) = ~10x token savings
- MCP tools for Claude to query its own memory

---

## What's Been Implemented

**Branch**: `feature/memory-system-upgrade`

Merged upstream v3.2.0's SQLite infrastructure and extended with three-tier/domain support:

### Database Schema (V2 Migration)
```sql
-- Observations now include:
domain TEXT,                    -- frontend, backend, auth, etc.
tier TEXT NOT NULL DEFAULT 'project'  -- seed, user, project
```

### New Types
```typescript
type ObservationDomain = 'frontend' | 'backend' | 'database' | 'auth' | 'testing' | 'devops' | 'docs' | 'orchestrator' | 'shared';
type MemoryTier = 'seed' | 'user' | 'project';
type ObservationType = ... | 'pattern' | 'decision' | 'handoff';
```

### New API Methods
```typescript
// Capture learnings
capturePattern(workerId, pattern, domain, tier?)
captureDecision(workerId, decision, domain, rationale?)
captureHandoff(workerId, summary, pendingItems?)

// Query
getDomainPatterns(domain)
getByDomain(domain)
getByTier(tier)
getDomains()
```

### Files Changed
- `src/memory/types.ts` - Added domain, tier, new observation types
- `src/memory/database.ts` - V2 migration for domain/tier columns
- `src/memory/observation-store.ts` - Domain/tier CRUD operations
- `src/memory/memory-service.ts` - Pattern/decision/handoff capture methods
- `src/memory/search.ts` - Domain/tier filtering in FTS5

All 88 tests pass.

---

## What's NOT Implemented (Required for System to Work)

### Option A: Lifecycle Hooks (Recommended)

Add Claude Code hooks that automatically capture observations:

```json
// ~/.claude/settings.json
{
  "hooks": {
    "PostToolUse": ["~/.claude/scripts/capture-tool-use.sh"],
    "SessionEnd": ["~/.claude/scripts/capture-session-end.sh"]
  }
}
```

**Pros**: Zero worker burden, automatic, follows claude-mem's proven approach
**Cons**: Requires hook scripts, captures everything (may need filtering)

### Option B: Session-End Enforcement Gate

Add `RETROSPECTIVE` state to worker lifecycle. Gate merge on `/assistant session-end`:

```typescript
// In orchestrator.ts
if (worker.reviewStatus === 'passed' && !worker.sessionEndCalled) {
  this.transitionState(workerId, 'RETROSPECTIVE');
  await this.nudgeWorker(worker, 'Run /assistant session-end before merge');
}
```

**Pros**: Guarantees handoff summaries, minimal friction (one command)
**Cons**: Still relies on worker compliance for pattern capture

### Option C: Retrospector Agent (Questionable Value)

A post-QA agent that reads worker output and extracts patterns automatically.

**Argument FOR**: Removes burden from workers, consistent extraction
**Argument AGAINST**:
- Extra agent run cost per PR
- May miss context only worker knew
- If we have lifecycle hooks, we already capture what happened
- The "why" behind decisions is hard to extract automatically

**Verdict**: Skip unless it provides meaningful token/context savings for the orchestrator. Lifecycle hooks + handoff enforcement covers the use case.

---

## Recommended Implementation Path

### Phase 1: Lifecycle Hooks (captures automatically)

1. Create `~/.claude/scripts/capture-tool-use.sh`:
   - Receives tool name, args, result
   - Filters to significant tools (file writes, git operations, API calls)
   - Calls memory service to capture observation

2. Create `~/.claude/scripts/capture-session-end.sh`:
   - Generates session summary from git log + changed files
   - Calls memory service to capture handoff

3. Register hooks in `~/.claude/settings.json`

### Phase 2: Session-End Enforcement (guarantees handoffs)

1. Add `sessionEndCalled` tracking to `WorkerInstance`
2. Detect `/assistant session-end` in worker JSONL output
3. Add `RETROSPECTIVE` state before `MERGING`
4. Nudge workers who try to merge without session-end

### Phase 3: Simplify Worker Training

1. Remove complex memory instructions from `worker-training-template.md`
2. Single requirement: "Run `/assistant session-end` when done"
3. Hooks handle pattern capture automatically

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `src/memory/memory-service.ts` | Main API for memory operations |
| `src/memory/database.ts` | SQLite schema and migrations |
| `src/worker-manager.ts` | Where to add sessionEnd detection |
| `src/orchestrator.ts` | Where to add RETROSPECTIVE gate |
| `src/state-machine.ts` | Where to add RETROSPECTIVE state |
| `~/.claude/settings.json` | Where to register lifecycle hooks |

---

## Questions to Resolve

1. **Hook granularity**: Capture every tool use, or filter to significant ones?
2. **Domain inference**: Auto-detect domain from file paths/tool types, or require explicit tagging?
3. **Tier selection**: All captures go to `project` tier, or allow hooks to specify tier?
4. **Worker vs orchestrator capture**: Who captures what? (Worker captures own learnings, orchestrator captures coordination events?)

---

## Session Summary

**Completed**:
- Comparative analysis of three memory systems
- Identified root cause: lack of enforcement
- Implemented SQLite infrastructure with domain/tier support
- All tests passing, branch pushed

**Pending**:
- Lifecycle hooks for automatic capture
- Session-end enforcement gate
- Worker training simplification

**Recommendation**: Implement lifecycle hooks first (Phase 1), then add enforcement (Phase 2). Skip retrospector agent unless token savings justify it.
