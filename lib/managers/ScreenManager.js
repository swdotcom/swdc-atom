'use babel';

export function toggleFullScreen() {
  atom.setFullScreen(!atom.isFullScreen());
  atom.commands.dispatch(
    atom.views.getView(atom.workspace),
    'Code-Time:refresh-code-time-metrics'
  );
}

function getZenConfigInfo() {
  return {
    zenFullscreen: atom.config.get("Zen.fullscreen"),
    zenWidth:  atom.config.get("Zen.fullscreen"),
    zenSoftWrap: atom.config.get("Zen.softWrap"),
    zenMinimap: atom.config.get("Zen.minimap")
  }
}
