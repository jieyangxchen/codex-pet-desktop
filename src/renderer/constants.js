export const CELL_WIDTH = 192;
export const CELL_HEIGHT = 208;
export const ATLAS_WIDTH = 1536;
export const ATLAS_HEIGHT = 1872;

export const STATES = {
  idle: { row: 0, frames: 6, fps: 5 },
  "running-right": { row: 1, frames: 8, fps: 10 },
  "running-left": { row: 2, frames: 8, fps: 10 },
  waving: { row: 3, frames: 4, fps: 6, once: true },
  jumping: { row: 4, frames: 5, fps: 8, once: true },
  failed: { row: 5, frames: 8, fps: 6, once: true },
  waiting: { row: 6, frames: 6, fps: 5 },
  running: { row: 7, frames: 6, fps: 7 },
  review: { row: 8, frames: 6, fps: 6 }
};
