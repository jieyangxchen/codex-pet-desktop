use serde::Serialize;
use tauri::{AppHandle, Manager, PhysicalPosition, Runtime, WebviewWindow};

const EDGE_VISIBILITY_PX: i32 = 48;

#[derive(Debug, Serialize)]
pub(crate) struct WindowBounds {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct WindowSize {
    width: u32,
    height: u32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct WorkArea {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct PositionLimits {
    min_x: i32,
    max_x: i32,
    min_y: i32,
    max_y: i32,
}

pub(crate) fn main_window<R: Runtime>(app: &AppHandle<R>) -> Result<WebviewWindow<R>, String> {
    app.get_webview_window("main")
        .ok_or_else(|| "main window not found".to_string())
}

fn clamp(value: i32, min: i32, max: i32) -> i32 {
    value.max(min).min(max)
}

fn loose_position_limits(size: WindowSize, work_area: WorkArea) -> PositionLimits {
    PositionLimits {
        min_x: work_area.x - size.width as i32 + EDGE_VISIBILITY_PX,
        max_x: work_area.x + work_area.width as i32 - EDGE_VISIBILITY_PX,
        min_y: work_area.y - size.height as i32 + EDGE_VISIBILITY_PX,
        max_y: work_area.y + work_area.height as i32 - EDGE_VISIBILITY_PX,
    }
}

fn clamp_position(
    size: WindowSize,
    work_area: WorkArea,
    requested_x: i32,
    requested_y: i32,
) -> PhysicalPosition<i32> {
    let limits = loose_position_limits(size, work_area);
    PhysicalPosition::new(
        clamp(requested_x, limits.min_x, limits.max_x),
        clamp(requested_y, limits.min_y, limits.max_y),
    )
}

fn current_work_area<R: Runtime>(window: &WebviewWindow<R>) -> Result<WorkArea, String> {
    let monitor = window
        .current_monitor()
        .map_err(|error| error.to_string())?
        .or(window
            .primary_monitor()
            .map_err(|error| error.to_string())?)
        .ok_or_else(|| "monitor not found".to_string())?;
    let work_area = monitor.work_area();
    Ok(WorkArea {
        x: work_area.position.x,
        y: work_area.position.y,
        width: work_area.size.width,
        height: work_area.size.height,
    })
}

fn outer_window_size<R: Runtime>(window: &WebviewWindow<R>) -> Result<WindowSize, String> {
    let size = window.outer_size().map_err(|error| error.to_string())?;
    Ok(WindowSize {
        width: size.width,
        height: size.height,
    })
}

pub(crate) fn clamp_loose_position<R: Runtime>(
    window: &WebviewWindow<R>,
    requested_x: i32,
    requested_y: i32,
) -> Result<PhysicalPosition<i32>, String> {
    Ok(clamp_position(
        outer_window_size(window)?,
        current_work_area(window)?,
        requested_x,
        requested_y,
    ))
}

pub(crate) fn reset_window_position<R: Runtime>(
    window: &WebviewWindow<R>,
) -> Result<WindowBounds, String> {
    let monitor = window
        .primary_monitor()
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "primary monitor not found".to_string())?;
    let work_area = monitor.work_area();
    let size = window.outer_size().map_err(|error| error.to_string())?;
    let next = PhysicalPosition::new(
        work_area.position.x + work_area.size.width as i32 - size.width as i32 - EDGE_VISIBILITY_PX,
        work_area.position.y + work_area.size.height as i32
            - size.height as i32
            - EDGE_VISIBILITY_PX,
    );
    window
        .set_position(next)
        .map_err(|error| error.to_string())?;
    Ok(WindowBounds {
        x: next.x,
        y: next.y,
        width: size.width,
        height: size.height,
    })
}

pub(crate) fn position_initial_window<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    let window = main_window(app)?;
    reset_window_position(&window)?;
    window.show().map_err(|error| error.to_string())?;
    window
        .set_ignore_cursor_events(true)
        .map_err(|error| error.to_string())?;
    Ok(())
}

pub(crate) fn move_window_by<R: Runtime>(
    window: &WebviewWindow<R>,
    x: f64,
    y: f64,
) -> Result<WindowBounds, String> {
    let position = window.outer_position().map_err(|error| error.to_string())?;
    let size = window.outer_size().map_err(|error| error.to_string())?;
    let next = clamp_loose_position(
        window,
        position.x + x.round() as i32,
        position.y + y.round() as i32,
    )?;
    window
        .set_position(next)
        .map_err(|error| error.to_string())?;
    Ok(WindowBounds {
        x: next.x,
        y: next.y,
        width: size.width,
        height: size.height,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn loose_limits_allow_dragging_to_edges_with_visible_strip() {
        let limits = loose_position_limits(
            WindowSize {
                width: 320,
                height: 340,
            },
            WorkArea {
                x: 0,
                y: 0,
                width: 1920,
                height: 1080,
            },
        );

        assert_eq!(
            limits,
            PositionLimits {
                min_x: -272,
                max_x: 1872,
                min_y: -292,
                max_y: 1032
            }
        );
    }

    #[test]
    fn clamp_position_keeps_at_least_edge_visibility() {
        let size = WindowSize {
            width: 320,
            height: 340,
        };
        let work_area = WorkArea {
            x: 0,
            y: 0,
            width: 1920,
            height: 1080,
        };

        assert_eq!(
            clamp_position(size, work_area, -500, -500),
            PhysicalPosition::new(-272, -292)
        );
        assert_eq!(
            clamp_position(size, work_area, 2200, 1400),
            PhysicalPosition::new(1872, 1032)
        );
    }
}
