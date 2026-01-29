# qwertZnake – Cursor notes

## Menu links (menu.js + game.js)

**How it works:** Sidebar links use `href="#…"` and `data-action`. The menu **does not** call `preventDefault()` for `stats`, `admin`, or `settings`; it only closes the overlay and returns. The browser then follows the link, the hash changes, and `hashchange` runs. **game.js** `handleHashNavigation()` reacts to the hash and opens the right modal.

**Fix for “link doesn’t work”:** For a new menu link that should open a modal, add its action to the **early-return** block in **menu.js** so the link is **not** prevented:

```js
if (action === 'stats' || action === 'admin' || action === 'settings') {
    closeOverlay();
    return;  // no preventDefault → hash changes → game.js opens modal
}
```

Then in **game.js** `handleHashNavigation()` add a `case 'yourhash': openYourModal(); break;`.

**Links that do prevent default:** `restart` (confirm dialog) and all other `menu-action` items (so sub-links like tutorial steps can still use hash).

## Writing challenges (10-Finger-Übung, Level beendet, Tutorial, other games)

**Always use the same style and behaviour** for any “type to continue” or typing challenge in this game (or other games in the project):

- **Modal style:** Same as the tutorial: white content card (`.tutorial-modal-content`-like), dark overlay `rgba(0,0,0,0.85)`, no gradient border, no “pop”/shimmer animations. Reuse the practice modal pattern (white `.practice-modal-content`) or the tutorial modal pattern.
- **Key UI:** Use the shared typing-key pattern:
  - Container: `.home-row-keys` with `.home-row-instruction` wrapper and `.instruction-text` hint.
  - Markup: `.home-row-key-wrapper` → `.home-row-key-animate` (with finger class, e.g. `finger-index`) + `.home-row-checkmark`. For wrong/corrected feedback add `.home-row-wrong-mark` and `.home-row-corrected-mark` where needed.
  - Animation: cycle the next key with `.active` (CSS `keyPulse`); when no key is typed yet, cycle through keys with a short pause on the last key (`.pausing`), then repeat. When the user types, show checkmarks (`.checked`) and keep the next expected key as `.active`.
- **Functions:** Reuse or mirror `renderVerstandenKeys` / `animateVerstandenKeys` / `updateVerstandenKeys` (or the practice equivalents `renderPracticePunkteKeys` / `animatePracticePunkteKeys` / `updatePracticePunkteKeys`) so behaviour and timing stay consistent.

When adding a new writing challenge (e.g. in another game), copy this pattern from the tutorial step 4 (“verstanden”) or the practice intro (“punkte”) and keep the same CSS classes and animation logic.

## Start screen

- **Einstellungen:** Top-right gear link (`#einstellungen`), same behavior as menu.
- **Removed from start:** Statistiken button, qwertzis (Tetris) link. Stats still available via menu (Bestenliste) and on game-over overlay.
