use crate::errors::NoteyError;
use crate::services::window_layout::{compute_layout, LayoutPlan, WorkArea};

/// Hides the calling window (dismiss without destroy).
#[tauri::command]
#[specta::specta]
pub fn dismiss_window(window: tauri::WebviewWindow) -> Result<(), NoteyError> {
    window
        .hide()
        .map_err(|e| NoteyError::Config(format!("Failed to hide window: {}", e)))?;
    Ok(())
}

/// Apply a window layout mode (`floating` / `half-screen` / `full-screen`) to the
/// calling window (Story 7.5).
///
/// Geometry is derived from the active monitor's usable work area (current monitor,
/// falling back to the primary) so the taskbar/dock is respected. All branching
/// lives in [`compute_layout`]; this command only applies the resulting plan. An
/// unknown mode returns [`NoteyError::Validation`] and leaves the window untouched;
/// individual window-property failures are logged best-effort so a partial platform
/// capability still yields the right size and always-on-top state.
#[tauri::command]
#[specta::specta]
pub fn apply_layout_mode(window: tauri::WebviewWindow, mode: String) -> Result<(), NoteyError> {
    // Resolve the active monitor (current → primary → none) for work area + scale.
    let monitor = window
        .current_monitor()
        .ok()
        .flatten()
        .or_else(|| window.primary_monitor().ok().flatten());

    let (work_area, scale) = match &monitor {
        Some(m) => {
            let wa = m.work_area();
            (
                Some(WorkArea {
                    x: wa.position.x,
                    y: wa.position.y,
                    width: wa.size.width,
                    height: wa.size.height,
                }),
                m.scale_factor(),
            )
        }
        None => (None, 1.0),
    };
    if monitor.is_none() {
        eprintln!(
            "warning: no monitor available for layout mode `{mode}`; falling back where possible"
        );
    }

    // Validation errors propagate (bad mode); a valid plan is always applied.
    let plan = compute_layout(&mode, work_area, scale)?;
    apply_plan(&window, &plan);
    Ok(())
}

/// Apply a resolved [`LayoutPlan`] to the window. Every call is best-effort: a
/// platform that rejects a property (e.g. runtime decoration toggling) logs and
/// continues so the mode switch as a whole still succeeds.
fn apply_plan(window: &tauri::WebviewWindow, plan: &LayoutPlan) {
    if !plan.maximize {
        // Leave any maximized state before flipping chrome/taskbar/geometry so
        // transitions out of full-screen can fully adopt the target layout.
        match window.is_maximized() {
            Ok(true) => {
                if let Err(e) = window.unmaximize() {
                    eprintln!("warning: unmaximize failed: {e}");
                }
            }
            Ok(false) => {}
            Err(e) => eprintln!("warning: is_maximized failed: {e}"),
        }
    }

    if let Err(e) = window.set_always_on_top(plan.always_on_top) {
        eprintln!("warning: set_always_on_top failed: {e}");
    }
    if let Err(e) = window.set_decorations(plan.decorations) {
        eprintln!("warning: set_decorations failed: {e}");
    }
    if let Err(e) = window.set_resizable(plan.resizable) {
        eprintln!("warning: set_resizable failed: {e}");
    }
    if let Err(e) = window.set_shadow(plan.shadow) {
        eprintln!("warning: set_shadow failed: {e}");
    }
    if let Err(e) = window.set_skip_taskbar(plan.skip_taskbar) {
        eprintln!("warning: set_skip_taskbar failed: {e}");
    }

    if plan.maximize {
        if let Err(e) = window.maximize() {
            eprintln!("warning: maximize failed: {e}");
        }
        return;
    }

    if let Some((w, h)) = plan.size {
        if let Err(e) = window.set_size(tauri::PhysicalSize::new(w, h)) {
            eprintln!("warning: set_size failed: {e}");
        }
    }

    match plan.position {
        Some((x, y)) => {
            if let Err(e) = window.set_position(tauri::PhysicalPosition::new(x, y)) {
                eprintln!("warning: set_position failed: {e}");
            }
        }
        None => {
            if let Err(e) = window.center() {
                eprintln!("warning: center failed: {e}");
            }
        }
    }
}
