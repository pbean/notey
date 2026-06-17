# Epic 8 Context: Onboarding & Platform Integration

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

New users get a fast, single-instruction first-run experience and the app behaves like a reliable native citizen on every supported OS. The epic delivers a first-launch onboarding overlay that teaches the one thing that matters (the capture shortcut), guides macOS users through the accessibility permission grant the global hotkey depends on, lets users customize the hotkey before they ever leave onboarding, configures auto-start on login so Notey is always ready, enforces per-user data/socket isolation on shared machines, and verifies that all functionality works across Windows, macOS, and Linux (X11, with a Wayland fallback path). The north star is the "60-second test": a brand-new user captures their first note within a minute, with no account, email, or feature tour.

## Stories

- Story 8.1: First-Run Detection & Onboarding Overlay
- Story 8.2: macOS Accessibility Permission Guidance
- Story 8.3: Hotkey Customization During Onboarding
- Story 8.4: Auto-Start on Login
- Story 8.5: Per-User Data Isolation
- Story 8.6: Cross-Platform Verification & Wayland Fallback

## Requirements & Constraints

- First-run is detected by the absence of an `onboarding_complete` flag in config; the overlay shows only on first launch and is never shown again once dismissed (by pressing the hotkey or Esc, both of which set the flag).
- Onboarding is a single screen, not a multi-step tour: product name, key-cap visualization of the configured hotkey, "Press it now to try", and muted skip/customize affordances. No "Step X of Y".
- macOS accessibility permission is the only expected friction point; the global hotkey will not work without it. Detect the grant state, guide the user to System Settings > Privacy & Security > Accessibility, and offer a skip-with-warning. This step is skipped entirely on non-macOS platforms.
- Hotkey customization during onboarding must capture a new key combination, detect conflicts (warn and retry on conflict), and on success persist to config and re-register immediately so the rest of onboarding reflects the new shortcut.
- Auto-start must be user-toggleable, persisted in config, and survive reboot so the app launches as a tray daemon with no user action. On macOS use the LaunchAgent mechanism.
- Per-user isolation is mandatory: data, config, logs, and IPC socket all live under the current user's platform-standard directories. The Unix socket uses a user-scoped path and 0600 (owner-only) permissions; socket-file permissions are the sole isolation mechanism for v1 (no auth token). Two users on one machine must have fully independent state and cannot reach each other's socket.
- No system-wide shared directories anywhere. No network calls of any kind.
- Cross-platform parity: every functional requirement must work on Windows 10/11, macOS 12+, and Linux X11, using platform-standard paths throughout. CI must produce artifacts for all 5 targets (Windows x64, macOS x64, macOS ARM64, Linux x64, Linux ARM64).
- Wayland: if the standard global-shortcut plugin fails to register, attempt a fallback (D-Bus portal via the `ashpd` crate); if no fallback works, notify the user that the global shortcut is unavailable on their compositor. XWayland is the baseline fallback for v1.

## Technical Decisions

- **Platform abstraction:** A `Platform` trait centralizes all OS-divergent behavior — `data_dir()`, `config_dir()`, `log_dir()`, `socket_path()`, `register_hotkey()`, `autostart_enable/disable()`, and accessibility checks. Concrete `#[cfg(target_os)]` implementations live in `platform/linux.rs`, `platform/macos.rs`, `platform/windows.rs`. Linux handles XDG paths, Wayland portal integration, and Unix socket paths; macOS handles accessibility permissions, macOS paths, NSPanel behavior; Windows handles named pipes, registry autostart, and Windows paths.
- **Config model:** Human-readable TOML. Onboarding state lives as an `onboarding_complete` boolean; auto-start lives under `[general] auto_start = true|false`. First-run detection keys off config/flag absence — treat it as an implementation detail, not an architectural concern.
- **Auto-start plugin:** Use `tauri-plugin-autostart` (verify the current version before pinning), registered with the macOS LaunchAgent launcher. Required capability ACL permissions: `autostart:allow-enable`, `autostart:allow-disable`, `autostart:allow-is-enabled`.
- **Window lifecycle:** The main window is created hidden at startup and toggled show/hide (never destroyed) to meet the hotkey-latency target; onboarding renders as an overlay within that single window. Views (editor, search, settings, onboarding) are managed by Zustand state, not routing.
- **Frontend structure:** Onboarding components live in `src/features/onboarding/` — `OnboardingOverlay.tsx` (welcome + hotkey setup) and `AccessibilityGuide.tsx` (macOS permission guidance). Follow project conventions: feature-based dirs, no barrel files, per-feature Zustand stores, typed IPC via tauri-specta bindings only.
- **Accessibility markup:** OnboardingOverlay uses `role="dialog"`, `aria-label="Welcome to Notey"`, `aria-modal="true"`, with focus on the instruction text and Esc to dismiss. Use Radix/shadcn primitives for focus trapping and keyboard handling rather than custom logic.
- **data-testid:** Onboarding overlay must expose `data-testid="onboarding-overlay"` and the hotkey key-cap visualization `data-testid="hotkey-display"`.
- **Quality gates:** P0 tests 100%, P1 tests ≥95%, no open high-severity bugs. Favor unit/integration tests; E2E is rationed — the first-run onboarding flow (P1-E2E-002: overlay display, hotkey-press dismissal, config persistence) is one of only 3 permitted E2E journeys across the whole product. Cross-platform work also carries visual-regression expectations on CI builds for all 3 platforms.

## UX & Interaction Patterns

- **First-run flow:** App detects first run -> main window opens with onboarding overlay -> (macOS only) accessibility guidance if permission not granted -> user presses the hotkey to dismiss the overlay and start their first capture; pressing Esc instead also completes onboarding (app minimizes to tray, user discovers the hotkey later via the tray menu). Onboarding never reappears.
- **Hotkey customization in onboarding:** A muted "Customize" affordance below the key caps enters a capture mode ("Press your preferred shortcut..."), updates the key caps live, validates for conflicts, and continues onboarding with the new shortcut once saved.
- **Progressive disclosure:** For the user's first 5 sessions, the StatusBar shows a "Ctrl+P for commands" hint in `var(--text-muted)`; it disappears permanently after the 5th session. (Track session count to drive this.)
- **Visual style:** Onboarding text and chrome may use the secondary proportional sans-serif stack (editor/note content stays monospace). Minimal, dense, single-screen presentation consistent with the rest of the app's tokens.

## Cross-Story Dependencies

- The configured hotkey shown and registered here is the same global-shortcut/window-summon machinery built in Epic 1 (Story 1.11); onboarding reuses and reconfigures it rather than reimplementing it. Hotkey conflict detection overlaps with Epic 7's hotkey configuration work — share the validation/registration path.
- Story 8.2 (macOS permission) and Story 8.3 (customization) are conditional enhancements layered onto the Story 8.1 overlay; 8.1 should expose the overlay states (`visible`, `macos-permission`, `dismissed`) those stories plug into.
- Story 8.5 (per-user paths/socket) and Story 8.6 (platform trait) are foundational to features built earlier: the data/config/log paths underpin Epic 1's database location and the socket path underpins Epic 6's CLI-to-app IPC. Coordinate so path/socket resolution has a single source of truth in the `Platform` abstraction.
- Story 8.6 is the integration capstone for the epic and the product — it verifies that FRs from all prior epics behave correctly per platform and that CI emits all 5 target artifacts.
