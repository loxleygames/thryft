/**
 * Thryft Timer — countdown timers, progress bars, and resource ticking
 *
 * Handles the three timing patterns common in idle/MMO games:
 * 1. Countdown text (build completes in 3m 42s)
 * 2. Progress bar fills (width tracks elapsed/total)
 * 3. Resource interpolation (tick displayed value between server polls)
 *
 * Usage — countdown text:
 *   <span data-timer data-completes-at="2026-08-21T14:30:00Z">...</span>
 *   <span data-timer data-completes-at="..." data-reload-on-complete>...</span>
 *   <span data-timer data-completes-at="..." data-sound="bell">...</span>
 *
 * Usage — progress bar:
 *   <div data-timer-fill data-started-at="..." data-completes-at="..."></div>
 *
 * Usage — resource ticking:
 *   <div data-timer-resource data-current="1234" data-rate="50" data-cap="5000">
 *     <span data-timer-resource-value></span>
 *   </div>
 *
 * The resource ticker expects a parent element with data-timer-resource and
 * data-timestamp (ms since epoch when server rendered), and child elements
 * with data-timer-resource-value to display the interpolated value.
 */
;(function () {
  'use strict'

  var completed = new Set()

  // ── Formatting ───────────────────────────────────────────

  function formatTime(ms) {
    if (ms <= 0) return 'Complete!'
    var s = Math.floor(ms / 1000)
    if (s < 60) return s + 's'
    var m = Math.floor(s / 60)
    if (m < 60) return m + 'm ' + (s % 60) + 's'
    var h = Math.floor(m / 60)
    return h + 'h ' + (m % 60) + 'm ' + (s % 60) + 's'
  }

  function formatNumber(n) {
    return Math.floor(n).toLocaleString('en-GB')
  }

  // ── Countdown timers ─────────────────────────────────────

  function updateTimers() {
    var now = Date.now()

    // Text countdowns
    document.querySelectorAll('[data-timer][data-completes-at]').forEach(function (el) {
      var target = new Date(el.dataset.completesAt).getTime()
      // Support Unix ms timestamps as well as ISO strings
      if (isNaN(target)) target = parseInt(el.dataset.completesAt)
      var remaining = Math.max(0, target - now)

      if (remaining <= 0) {
        el.textContent = 'Complete!'
        if (!completed.has(el)) {
          completed.add(el)
          el.classList.add('timer-complete')

          // Sound hook
          var sound = el.dataset.sound
          if (sound && window.Thryft && window.Thryft.sound) {
            window.Thryft.sound.play(sound)
          }

          // Completion callback
          var cb = el.dataset.onComplete
          if (cb && typeof window[cb] === 'function') {
            window[cb](el)
          }

          // Fire event
          el.dispatchEvent(new CustomEvent('thryft:complete', { bubbles: true }))

          // Auto-reload
          if (el.hasAttribute('data-reload-on-complete')) {
            setTimeout(function () { window.location.reload() }, 1000)
          }
        }
        return
      }

      el.textContent = formatTime(remaining)
    })

    // Progress bar fills
    document.querySelectorAll('[data-timer-fill][data-completes-at]').forEach(function (el) {
      var start = new Date(el.dataset.startedAt).getTime()
      if (isNaN(start)) start = parseInt(el.dataset.startedAt)
      var end = new Date(el.dataset.completesAt).getTime()
      if (isNaN(end)) end = parseInt(el.dataset.completesAt)

      var total = end - start
      var elapsed = now - start
      var pct = Math.min(100, Math.max(0, (elapsed / total) * 100))
      el.style.width = pct + '%'

      if (now >= end && !el.dataset.done) {
        el.dataset.done = '1'
        el.style.width = '100%'
      }
    })
  }

  // ── Resource ticking ─────────────────────────────────────

  function tickResources() {
    document.querySelectorAll('[data-timer-resource]').forEach(function (el) {
      var serverTime = parseInt(el.dataset.timestamp) || Date.now()
      var elapsed = (Date.now() - serverTime) / 3600000 // hours since render

      var base = parseFloat(el.dataset.current) || 0
      var rate = parseFloat(el.dataset.rate) || 0
      var cap = parseFloat(el.dataset.cap) || Infinity

      if (rate <= 0 && !el.dataset.showValue) return

      var current = Math.min(base + rate * elapsed, cap)
      var prevFloor = parseInt(el.dataset.lastFloor) || Math.floor(base)
      var newFloor = Math.floor(current)

      // Update display value
      var valueEl = el.querySelector('[data-timer-resource-value]')
      if (valueEl) {
        valueEl.textContent = formatNumber(current)
      }

      // Update fill bar if present
      var fillEl = el.querySelector('[data-timer-resource-fill]')
      if (fillEl && cap < Infinity && cap > 0) {
        fillEl.style.width = Math.min(100, (current / cap) * 100) + '%'
      }

      // Pulse animation when a whole unit ticks over
      if (newFloor > prevFloor && rate > 0) {
        el.classList.add('res-tick')
        setTimeout(function () { el.classList.remove('res-tick') }, 400)
      }
      el.dataset.lastFloor = newFloor
    })
  }

  // ── Tick loop ────────────────────────────────────────────

  function tick() {
    updateTimers()
    tickResources()
  }

  setInterval(tick, 1000)

  // Re-tick after fetch swaps (picks up new timer elements)
  document.addEventListener('thryft:swap', tick)

  // ── Init ─────────────────────────────────────────────────

  document.addEventListener('DOMContentLoaded', tick)

  // ── Public API ───────────────────────────────────────────

  window.Thryft = window.Thryft || {}
  window.Thryft.timer = {
    /** Format milliseconds as countdown string */
    format: formatTime,
    /** Format a number with locale separators */
    formatNumber: formatNumber,
    /** Manually trigger a tick */
    tick: tick
  }
})()
