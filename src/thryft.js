/**
 * Thryft — Game UI toolkit for server-rendered browser games
 *
 * Combined bundle. Load this single file to get all modules:
 *   - fetch.js  — DOM-diffing HTML swap engine (HTMX replacement)
 *   - tooltip.js — Unified tooltip positioning
 *   - timer.js  — Countdown timers, progress bars, resource ticking
 *   - sound.js  — Audio preloading and playback
 *   - modal.js  — Lightbox/overlay system
 *   - inventory.js — Grid with drag/drop and context menu
 *
 * Or load modules individually via <script src="/js/thryft/fetch.js">
 *
 * All modules attach to window.Thryft namespace:
 *   Thryft.fetch.refresh('#resource-bar')
 *   Thryft.tooltip.hide()
 *   Thryft.timer.format(65000)  // "1m 5s"
 *   Thryft.sound.play('bell')
 *   Thryft.modal.open('#inventory')
 *   Thryft.inventory.hideMenu()
 */

// This file is the entry point for the combined bundle.
// Individual modules are concatenated during build.
// When loading thryft.js, all modules initialise automatically.
