// ── Input Manager ──
// Tracks keyboard state. Consumed by overworld and battle systems.

const _keys = new Set();
const _justPressed = new Set();
const _justReleased = new Set();

export const Input = {
  /** Call once at startup */
  init() {
    window.addEventListener('keydown', (e) => {
      if (!_keys.has(e.code)) _justPressed.add(e.code);
      _keys.add(e.code);
      // Prevent arrow key scrolling
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
    });

    window.addEventListener('keyup', (e) => {
      _keys.delete(e.code);
      _justReleased.add(e.code);
    });

    // Clear state when window loses focus
    window.addEventListener('blur', () => {
      _keys.clear();
      _justPressed.clear();
      _justReleased.clear();
    });
  },

  /** Call at end of each frame to flush one-frame events */
  endFrame() {
    _justPressed.clear();
    _justReleased.clear();
  },

  /** Is key currently held? */
  held(code) {
    return _keys.has(code);
  },

  /** Was key pressed this frame? */
  pressed(code) {
    return _justPressed.has(code);
  },

  /** Was key released this frame? */
  released(code) {
    return _justReleased.has(code);
  },

  /** Directional input as unit vector */
  direction() {
    let dx = 0, dy = 0;
    if (_keys.has('KeyW') || _keys.has('ArrowUp'))    dy -= 1;
    if (_keys.has('KeyS') || _keys.has('ArrowDown'))  dy += 1;
    if (_keys.has('KeyA') || _keys.has('ArrowLeft'))  dx -= 1;
    if (_keys.has('KeyD') || _keys.has('ArrowRight')) dx += 1;
    // Normalize diagonal
    if (dx !== 0 && dy !== 0) {
      const inv = 1 / Math.SQRT2;
      dx *= inv;
      dy *= inv;
    }
    return { x: dx, y: dy };
  },

  /** Is sprint held? */
  sprinting() {
    return _keys.has('ShiftLeft') || _keys.has('ShiftRight');
  },
};
