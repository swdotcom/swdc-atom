'use babel';

export const NORMAL_SCREEN_MODE = 0;
export const ZEN_MODE_ID = 1; // currently not used
export const FULL_SCREEN_MODE_ID = 2;

let screenMode: number = 0;

export function updateScreenMode(screen_mode) {
  screenMode = screen_mode;
}

export function getScreenMode() {
  return screenMode;
}

export function enterFullScreen() {
  let screenModeChanged = false;
  if (!atom.isFullScreen()) {
    atom.toggleFullScreen();
    screenModeChanged = true;
  }
  atom.commands.dispatch(
    atom.views.getView(atom.workspace),
    'Code-Time:refresh-flow-nodes'
  );
  screenMode = FULL_SCREEN_MODE_ID;
  return screenModeChanged;
}

export function exitFullScreen() {
  let screenModeChanged = false;
  if (atom.isFullScreen()) {
    atom.toggleFullScreen();
    screenModeChanged = true;
  }
  atom.commands.dispatch(
    atom.views.getView(atom.workspace),
    'Code-Time:refresh-flow-nodes'
  );
  screenMode = NORMAL_SCREEN_MODE;
  return screenModeChanged;
}
