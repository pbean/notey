# Story Automator Learnings

## Run: 2026-04-05T01:38Z

**Epic:** Workspace-Aware Note Organization (Epic 2)
**Stories:** 2.1-2.6

### Patterns Observed
- Codex agent fails in fish shell environment (tmux sessions inherit user's default shell)
- The `unset CLAUDECODE && ...` bash syntax from build-cmd breaks in fish — needed `bash -c` wrapper
- All 6 stories completed successfully with claude agent after codex fallback
- Every story passed code review in a single cycle

### Code Review Insights
- Common issues: None significant — all passed first cycle
- Average cycles to clean: 1

### Environment Notes
- Fish shell requires `bash -c` wrapper for tmux-spawned commands
- Codex commands with multi-line prompts break when fish interprets each line separately

### Recommendations for Future Runs
- Consider configuring tmux to use bash as default shell for story-automator sessions
- Or update `tmux-wrapper spawn` to always wrap commands in `bash -c` for portability
- Use `claude` as primary agent when running on fish shell systems until codex wrapper is fixed
