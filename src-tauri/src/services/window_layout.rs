//! Pure geometry/property planning for window layout modes (Story 7.5).
//!
//! Applying a layout mode needs a live [`tauri::WebviewWindow`], which cannot be
//! constructed in a unit test. All mode → geometry/property branching therefore
//! lives here as a pure function over a plain [`WorkArea`]; the
//! `apply_layout_mode` command is a thin applier of the returned [`LayoutPlan`].
//!
//! The three canonical modes are:
//! - `floating` — always-on-top, borderless drop-shadow overlay, resizable,
//!   600×400 (logical) centered on the active monitor.
//! - `half-screen` — standard chrome, not always-on-top, full work-area width by
//!   half work-area height, centered on the active monitor's work area.
//! - `full-screen` — standard chrome, not always-on-top, maximized (not exclusive
//!   fullscreen).

use crate::errors::NoteyError;

/// Logical width of the floating overlay, in pixels.
pub const FLOATING_WIDTH: u32 = 600;
/// Logical height of the floating overlay, in pixels.
pub const FLOATING_HEIGHT: u32 = 400;

/// The usable area of a monitor (work area, excluding taskbar/dock), in physical
/// pixels. A plain struct so [`compute_layout`] is testable without a Tauri runtime.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct WorkArea {
    /// Work-area top-left X, in physical pixels.
    pub x: i32,
    /// Work-area top-left Y, in physical pixels.
    pub y: i32,
    /// Work-area width, in physical pixels.
    pub width: u32,
    /// Work-area height, in physical pixels.
    pub height: u32,
}

/// A resolved plan describing how to size, position, and decorate the window for
/// a layout mode. The applier sets the properties best-effort and then either
/// maximizes or applies `size`/`position`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LayoutPlan {
    /// Physical size to set, or `None` to leave the current size (no monitor) or
    /// when [`Self::maximize`] is set.
    pub size: Option<(u32, u32)>,
    /// Physical top-left position, or `None` to center on the active monitor.
    pub position: Option<(i32, i32)>,
    /// Whether the window floats above all others.
    pub always_on_top: bool,
    /// Whether the window shows standard chrome (title bar / borders).
    pub decorations: bool,
    /// Whether the user can resize the window.
    pub resizable: bool,
    /// Whether the OS drop shadow is enabled (used by the borderless overlay).
    pub shadow: bool,
    /// Whether the window is hidden from the taskbar (overlay behavior).
    pub skip_taskbar: bool,
    /// When `true`, maximize the window (full-screen) instead of applying
    /// `size`/`position`.
    pub maximize: bool,
}

/// Resolve a layout mode plus the active monitor's work area into a [`LayoutPlan`].
///
/// `scale_factor` converts the floating overlay's logical 600×400 into physical
/// pixels; a non-positive value is treated as `1.0`. `work_area` is `None` when no
/// monitor could be resolved — `half-screen` then keeps the current size and only
/// recenters, while `floating`/`full-screen` need no work-area math.
///
/// Returns [`NoteyError::Validation`] for any non-canonical mode string (legacy
/// density values like `compact`/`comfortable` are normalized on the frontend
/// before this is called, so they are rejected here).
pub fn compute_layout(
    mode: &str,
    work_area: Option<WorkArea>,
    scale_factor: f64,
) -> Result<LayoutPlan, NoteyError> {
    let scale = if scale_factor > 0.0 { scale_factor } else { 1.0 };

    match mode {
        "floating" => Ok(LayoutPlan {
            size: Some((
                (f64::from(FLOATING_WIDTH) * scale).round() as u32,
                (f64::from(FLOATING_HEIGHT) * scale).round() as u32,
            )),
            position: None,
            always_on_top: true,
            decorations: false,
            resizable: true,
            shadow: true,
            skip_taskbar: true,
            maximize: false,
        }),
        "half-screen" => {
            let (size, position) = match work_area {
                Some(wa) => {
                    let w = wa.width;
                    let h = (f64::from(wa.height) / 2.0).round() as u32;
                    // width == work-area width, so the X offset is zero; Y is
                    // centered so the window sits as a centered horizontal half,
                    // compatible with the summon-path `center()` call.
                    let x = wa.x + (wa.width.saturating_sub(w) as i32) / 2;
                    let y = wa.y + (wa.height.saturating_sub(h) as i32) / 2;
                    (Some((w, h)), Some((x, y)))
                }
                None => (None, None),
            };
            Ok(LayoutPlan {
                size,
                position,
                always_on_top: false,
                decorations: true,
                resizable: true,
                shadow: false,
                skip_taskbar: false,
                maximize: false,
            })
        }
        "full-screen" => Ok(LayoutPlan {
            size: None,
            position: None,
            always_on_top: false,
            decorations: true,
            resizable: true,
            shadow: false,
            skip_taskbar: false,
            maximize: true,
        }),
        other => Err(NoteyError::Validation(format!("Unknown layout mode: {other}"))),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const FHD: WorkArea = WorkArea {
        x: 0,
        y: 0,
        width: 1920,
        height: 1080,
    };

    #[test]
    fn floating_is_overlay_at_logical_size() {
        let plan = compute_layout("floating", Some(FHD), 1.0).unwrap();
        assert_eq!(plan.size, Some((600, 400)));
        assert_eq!(plan.position, None);
        assert!(plan.always_on_top);
        assert!(!plan.decorations);
        assert!(plan.resizable);
        assert!(plan.shadow);
        assert!(plan.skip_taskbar);
        assert!(!plan.maximize);
    }

    #[test]
    fn floating_scales_logical_size_to_physical() {
        let plan = compute_layout("floating", None, 2.0).unwrap();
        assert_eq!(plan.size, Some((1200, 800)));
    }

    #[test]
    fn floating_treats_non_positive_scale_as_one() {
        let plan = compute_layout("floating", None, 0.0).unwrap();
        assert_eq!(plan.size, Some((600, 400)));
        let plan = compute_layout("floating", None, -1.0).unwrap();
        assert_eq!(plan.size, Some((600, 400)));
    }

    #[test]
    fn half_screen_is_full_width_half_height_centered() {
        let plan = compute_layout("half-screen", Some(FHD), 1.0).unwrap();
        assert_eq!(plan.size, Some((1920, 540)));
        assert_eq!(plan.position, Some((0, 270)));
        assert!(!plan.always_on_top);
        assert!(plan.decorations);
        assert!(!plan.maximize);
    }

    #[test]
    fn half_screen_respects_work_area_offset() {
        let wa = WorkArea {
            x: 100,
            y: 50,
            width: 1000,
            height: 800,
        };
        let plan = compute_layout("half-screen", Some(wa), 1.0).unwrap();
        assert_eq!(plan.size, Some((1000, 400)));
        assert_eq!(plan.position, Some((100, 250)));
    }

    #[test]
    fn half_screen_rounds_odd_height() {
        let wa = WorkArea {
            x: 0,
            y: 0,
            width: 1000,
            height: 1081,
        };
        let plan = compute_layout("half-screen", Some(wa), 1.0).unwrap();
        // 1081 / 2 = 540.5 → rounds to 541; y centers the remaining 540.
        assert_eq!(plan.size, Some((1000, 541)));
        assert_eq!(plan.position, Some((0, 270)));
    }

    #[test]
    fn half_screen_without_monitor_keeps_size_and_centers() {
        let plan = compute_layout("half-screen", None, 1.0).unwrap();
        assert_eq!(plan.size, None);
        assert_eq!(plan.position, None);
        assert!(plan.decorations);
        assert!(!plan.maximize);
    }

    #[test]
    fn full_screen_maximizes_with_chrome() {
        let plan = compute_layout("full-screen", Some(FHD), 1.0).unwrap();
        assert!(plan.maximize);
        assert_eq!(plan.size, None);
        assert_eq!(plan.position, None);
        assert!(!plan.always_on_top);
        assert!(plan.decorations);
    }

    #[test]
    fn unknown_mode_is_validation_error() {
        let err = compute_layout("bogus", Some(FHD), 1.0).unwrap_err();
        match err {
            NoteyError::Validation(msg) => assert!(msg.contains("bogus")),
            other => panic!("expected Validation, got {other:?}"),
        }
    }

    #[test]
    fn legacy_density_values_are_rejected() {
        // Legacy density strings are normalized to a window mode on the frontend;
        // reaching the backend with one is a Validation error, not a silent map.
        assert!(compute_layout("comfortable", Some(FHD), 1.0).is_err());
        assert!(compute_layout("compact", Some(FHD), 1.0).is_err());
    }
}
