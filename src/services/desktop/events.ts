// The window event fired just before the desktop app closes. Screens that hold a question on screen
// save its time on it, as they do on pagehide. Kept apart from ./index so screens can import it
// without pulling in the stores.

export const BEFORE_EXIT_EVENT = 'blackbook:before-exit';
