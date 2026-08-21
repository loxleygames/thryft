# Thryft

**Game UI toolkit for server-rendered browser games.**

Tiny, standalone JS modules for the UI patterns every MMO and idle game needs — tooltips, timers, inventory grids, modals, sound effects, and a DOM-diffing fetch engine that replaces HTMX without the flicker.

No React. No build step. No virtual DOM. Just `<script>` tags and `data-*` attributes.

## Modules

| Module | Size | Purpose |
|--------|------|---------|
| **fetch.js** | ~4KB | DOM-diffing HTML swap engine. Replaces HTMX. |
| **tooltip.js** | ~3KB | Viewport-aware tooltip positioning (anchored + cursor-follow). |
| **timer.js** | ~3KB | Countdown timers, progress bars, resource interpolation. |
| **sound.js** | ~2KB | Audio preloading and playback with mute toggle. |
| **modal.js** | ~3KB | Lightbox/overlay with stacking, Escape, click-outside. |
| **inventory.js** | ~5KB | Drag/drop grid with context menu and touch support. |
| **thryft.js** | ~20KB | Combined bundle (all modules). |

Load individually or use `thryft.js` for the combined bundle. Each module attaches to `window.Thryft`.

## Quick Start

```html
<script src="/js/thryft.js"></script>
```

Or load only what you need:

```html
<script src="/js/thryft/fetch.js"></script>
<script src="/js/thryft/timer.js"></script>
<script src="/js/thryft/sound.js"></script>
```

## fetch.js — DOM-Diffing Fetch Engine

Replaces HTMX. Fetches HTML from endpoints and patches the DOM via diffing instead of replacing entire elements.

```html
<!-- Poll every 30s, diff changes into DOM (no flicker) -->
<div data-fetch="/api/resources" data-interval="30000" data-swap="inner">
  ...server-rendered content...
</div>

<!-- Load once on page load -->
<div data-fetch="/api/activity" data-trigger="load" data-swap="inner"></div>

<!-- Click to load content into a target -->
<button data-fetch="/api/inventory" data-target="#modal" data-swap="inner">
  Open Inventory
</button>

<!-- Callback after swap -->
<div data-fetch="/api/badge" data-interval="15000" data-onswap="onBadgeUpdate">
</div>
```

| Attribute | Purpose |
|-----------|---------|
| `data-fetch` | URL to fetch HTML from |
| `data-interval` | Poll interval in ms |
| `data-trigger` | `"load"` to fetch on page load |
| `data-swap` | `"inner"` (diff innerHTML) or `"outer"` (replace element) |
| `data-target` | CSS selector for where to put the response |
| `data-onswap` | Global function name to call after swap |

**JS API:**

```js
Thryft.fetch.refresh('#resource-bar')   // Manually trigger a fetch
Thryft.fetch.swap('#target', '<p>Hi</p>')  // Manually diff-swap HTML
Thryft.fetch.stop('#resource-bar')      // Stop polling
```

### Why Not HTMX?

HTMX tears down and rebuilds entire DOM subtrees on every swap. When a resource counter ticks from "1,234" to "1,235", HTMX replaces the whole element — killing CSS animations, causing layout flicker, and shipping 14KB for features games don't use (WebSocket, history, forms, CSS transitions).

Thryft diffs the old and new DOM and patches only what changed. One text node update, no flash.

## timer.js — Countdowns, Progress Bars, Resource Ticking

```html
<!-- Countdown text -->
<span data-timer data-completes-at="2026-08-21T14:30:00Z"></span>

<!-- Auto-reload page on completion -->
<span data-timer data-completes-at="..." data-reload-on-complete></span>

<!-- Play sound on completion -->
<span data-timer data-completes-at="..." data-sound="bell"></span>

<!-- Progress bar fill -->
<div data-timer-fill data-started-at="..." data-completes-at="..."
     style="height:14px; background:#8b4513;"></div>

<!-- Resource interpolation (ticks up between server polls) -->
<div data-timer-resource data-current="1234" data-rate="50" data-cap="5000"
     data-timestamp="1724234400000">
  <span data-timer-resource-value></span>/5,000
</div>
```

**JS API:**

```js
Thryft.timer.format(65000)  // "1m 5s"
Thryft.timer.formatNumber(12345)  // "12,345"
Thryft.timer.tick()  // Manually trigger a tick
```

## tooltip.js — Positioned Tooltips

Two modes: **anchored** (positions above/below the trigger) and **cursor-following**.

```html
<!-- Anchored tooltip -->
<span class="has-tooltip">
  Hover me
  <div class="tooltip-box">
    <img src="/icon.png" style="width:32px">
    <div>
      <strong>Item Name</strong>
      <p>Description here</p>
    </div>
  </div>
</span>

<!-- Cursor-following tooltip -->
<span data-tooltip="info-tip">Hover me</span>
<div id="info-tip" class="tooltip-box">Follows the cursor</div>

<!-- Dynamic content via callback -->
<span data-tooltip="tip" data-tooltip-fill="fillTip">Hover</span>
<script>
function fillTip(tooltipEl, triggerEl) {
  tooltipEl.innerHTML = '<strong>' + triggerEl.dataset.name + '</strong>';
}
</script>
```

**JS API:**

```js
Thryft.tooltip.show('#tooltip', '#trigger', 'anchored')
Thryft.tooltip.hide()
Thryft.tooltip.position(tooltipEl, triggerEl)
```

## sound.js — Audio Preloading & Playback

Preloads audio on first user interaction (click/touch/keydown). Mute toggle backed by localStorage.

```js
// Register sounds
Thryft.sound.register({
  click:   { src: '/audio/click.mp3', vol: 0.5 },
  bell:    { src: '/audio/bell.mp3', vol: 0.4 },
  fanfare: { src: '/audio/fanfare.mp3', vol: 0.5 },
});

// Play
Thryft.sound.play('bell');

// Mute toggle
Thryft.sound.toggle();        // returns new state
Thryft.sound.isEnabled();     // check state
Thryft.sound.setEnabled(true);
```

Integrates with timer.js — use `data-sound="bell"` on timer elements to play a sound on completion.

## modal.js — Lightbox/Overlay System

```html
<!-- Load content from server into modal -->
<button data-modal-fetch="/api/news" data-modal-target="#modal">News</button>
<div id="modal" class="thryft-modal"></div>

<!-- Toggle existing modal -->
<button data-modal-toggle="#settings">Settings</button>
<div id="settings" class="thryft-modal" style="display:none">
  <div class="thryft-modal-backdrop"></div>
  <div class="thryft-modal-content">...</div>
</div>

<!-- Close button -->
<button data-modal-close>×</button>
```

Escape closes topmost modal. Click on backdrop closes. Body gets `thryft-modal-active` class for scroll lock.

**JS API:**

```js
Thryft.modal.open('#modal')
Thryft.modal.open('#modal', '/api/content')  // fetch + open
Thryft.modal.close()       // close topmost
Thryft.modal.close('#modal')
Thryft.modal.isOpen()
Thryft.modal.current()     // topmost modal element
```

## inventory.js — Grid with Drag/Drop

```html
<div class="inv-grid">
  <div class="inv-cell" data-item-key="sword" data-quantity="1"
       data-name="Iron Sword" data-description="A sturdy blade."
       data-max-stack="1" data-actions="equip,drop" draggable="true">
    <img src="/icons/sword.png" class="inv-icon">
    <span class="inv-qty">1</span>
  </div>
  <div class="inv-cell inv-cell-empty"></div>
</div>
```

Features: hover tooltips, click context menu with custom actions, drag-to-reorder (mouse + touch), action callbacks via fetch.

## Build

```bash
node build.js
```

Concatenates modules into `dist/thryft.js` and copies individual modules to `dist/`.

## Used By

- [Dunmast](https://dunmast.com) — Naval idle MMO
- Thrynd — Dwarf mining idle game (in development)

## License

MIT
