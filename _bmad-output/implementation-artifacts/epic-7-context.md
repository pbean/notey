# Epic 7 Context: Personalization & Accessibility

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

This epic makes Notey adaptable to each user and usable by everyone. It delivers a central settings surface where users control theme (dark/light), font family and size, the global capture hotkey, in-app keyboard shortcuts, and window layout mode, with all preferences persisted to a human-readable TOML config. It also closes out the accessibility commitments that span the whole app: complete keyboard-only navigation, visible and conformant focus indicators, screen-reader semantics, and a WCAG 2.1 AA contrast audit across both themes. The work matters because Notey is a keyboard-first capture tool — personalization removes friction for power users, and accessibility is a hard requirement, not a polish item. This epic depends on UI components, the config command surface, and the window/hotkey infrastructure built in earlier epics; it primarily wires settings UI to existing backend config and re-validates accessibility across already-built components.

## Stories

- Story 7.1: Settings View Panel
- Story 7.2: Theme Switching (Dark/Light)
- Story 7.3: Font Configuration
- Story 7.4: Global Hotkey Reconfiguration & Conflict Detection
- Story 7.5: Layout Mode Switching
- Story 7.6: Keyboard Shortcut Configuration
- Story 7.7: Comprehensive Keyboard Navigation
- Story 7.8: Accessibility Compliance Audit

## Requirements & Constraints

- Every preference change must persist to the TOML config and survive app restart. Settings that can apply live (theme, font size/family) must do so immediately without requiring a restart or full re-render.
- Theme switching must be an instantaneous CSS-variable swap — no component re-render, no layout reflow. On first launch with no saved preference, fall back to the OS `prefers-color-scheme`; a saved manual preference always overrides the system setting.
- Font size is constrained to a 12–24px range; the type scale must scale proportionally from the chosen base rather than only changing one element.
- Global hotkey reconfiguration must detect conflicts with existing system/app shortcuts before committing: on conflict, keep the old shortcut active and surface a 5-second toast naming the conflicting app. Only on a valid binding is the old shortcut unregistered and the new one registered. A "Reset to default" path must restore the platform default (Ctrl+Shift+N / Cmd+Shift+N on macOS).
- Layout mode cycles Floating → Half-screen → Full-screen → Floating. Floating is the always-on-top, drop-shadow, resizable 600x400 overlay; half-screen and full-screen are NOT always-on-top and use standard chrome. Chosen mode persists across restarts.
- Accessibility is enforced, not aspirational: every interactive element must be reachable via Tab/Shift+Tab in visual order; focus indicators are a 2px outline at 2px offset using the focus-ring token with ≥3:1 contrast against adjacent colors; overlays trap focus so it never escapes to content behind them; `prefers-reduced-motion` makes all focus/transition animation instant.
- State must never be conveyed by color alone — pair every status indicator (save state, active tab, search match) with a text label or non-color affordance (e.g. underline + weight for the active tab).
- Screen-reader semantics required: `aria-live="polite"` save announcements, `role="status"` on the status bar, an `aria-label` or visible label on every interactive element.
- Minimum interactive target height is 24px.
- Contrast audit (both themes, independently): text ≥4.5:1, UI components and focus indicators ≥3:1, meeting WCAG 2.1 AA.

## Technical Decisions

- Settings live in a per-feature Zustand store (`useSettingsStore`) covering theme, font, shortcuts, and layout mode. Follow the project's feature-based layout (`src/features/settings/` with components, hooks, and `store.ts`); no barrel files, import directly from source.
- Persistence flows through existing config Tauri commands (`get_config` / `update_config`) backed by a Rust `config_service` that reads/writes the TOML file; config models are `AppConfig` and `ShortcutConfig`. Do not invent a new persistence path.
- TOML config is organized into sections that map to settings groups: `[general]` (theme, `layout_mode`), `[editor]` (`font_size`, `font_family`), `[hotkey]` (`global_shortcut`), and `[shortcuts]` (per-action in-app bindings). Advanced users may hand-edit the file, so writes must produce valid, readable TOML.
- All config commands are invoked through tauri-specta generated bindings — never hand-typed `invoke()` calls — and any new command must be added to the main-window capability ACL (default-deny).
- Theme is driven by a `data-theme` attribute on `html` toggling between `dark` and `light`; the design-token CSS variables already defined are the single source of truth — switching themes only swaps which token set is active.
- Global hotkey (re)registration uses `tauri-plugin-global-shortcut`; layout-mode changes drive Tauri window properties (size, always-on-top, chrome) and should center on the active monitor consistent with existing window-summon behavior.
- Default in-app shortcut set must match the established keyboard map: Esc (back/hide), Ctrl/Cmd+P (palette), Ctrl/Cmd+F (search), Ctrl/Cmd+N (new note), Ctrl/Cmd+W (close tab), Ctrl+Tab / Ctrl+Shift+Tab (tab nav), Ctrl/Cmd+, (settings), Ctrl/Cmd+Shift+T (toggle theme), Ctrl/Cmd+Shift+W (switch workspace). Custom bindings load at startup.
- Favor unit/integration tests over E2E per the project-wide test constraint; the epic's quality gate is P0 100% / P1 ≥95% with no open high-severity bugs. Accessibility and contrast checks are well-suited to component/unit assertions.

## UX & Interaction Patterns

- Settings open via Ctrl/Cmd+, or the "Open Settings" command-palette entry, render as a modal/overlay with General, Editor, and Hotkey sections, and dismiss with Esc. The overlay must dim its backdrop and trap focus.
- Hotkey/shortcut rebinding uses a capture mode: the field shows "Press new shortcut…" and waits for the next key combination, with confirm/cancel and inline conflict warning.
- Conflict and other completed-action feedback use non-blocking toasts (bottom-right, auto-dismiss, no action buttons), never modal interruptions.
- Layout mode is also reachable via the "Toggle Layout Mode" command-palette entry that cycles the three modes.
- Esc follows the app-wide back-out hierarchy (overlay → editor → hide window); the settings overlay is the top layer when open.

## Cross-Story Dependencies

- Story 7.1 (Settings View Panel) is the host surface; 7.2 (theme), 7.3 (font), 7.4 (hotkey), and the shortcuts list from 7.6 all render inside its sections and should be built against it.
- 7.7 (Keyboard Navigation) and 7.8 (Accessibility Audit) are cross-cutting: they validate and harden components delivered across all prior epics (editor, tabs, status bar, search overlay, command palette, note list, onboarding), not just Epic 7's own UI — apply fixes wherever gaps surface, not only within this epic's new code.
- Depends on earlier-epic infrastructure: the config command surface and TOML service, the design-token/theme system, the command palette, and the global-hotkey + window-management plumbing (default hotkey registration, always-on-top floating window) must exist before these stories can wire into them.
