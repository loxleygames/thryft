/**
 * Thryft Tooltip — unified tooltip positioning engine
 *
 * One tooltip system for all hover info: items, ships, resources, dwarfs.
 * Handles viewport-aware positioning, follows cursor or anchors to element.
 *
 * Usage (anchored — positions above/below the trigger element):
 *   <div class="has-tooltip">
 *     Hover target
 *     <div class="tooltip-box">Tooltip content here</div>
 *   </div>
 *
 * Usage (follow cursor — tooltip tracks mouse position):
 *   <div data-tooltip="my-tooltip">Hover target</div>
 *   <div id="my-tooltip" class="tooltip-box">Content</div>
 *
 * Usage (dynamic content via callback):
 *   <div data-tooltip="info-tip" data-tooltip-fill="fillShipTooltip">Ship</div>
 *
 *   function fillShipTooltip(tooltipEl, triggerEl) {
 *     tooltipEl.querySelector('.name').textContent = triggerEl.dataset.name
 *   }
 */
;(function () {
  'use strict'

  var OFFSET = 8
  var EDGE_MARGIN = 4
  var activeTooltip = null
  var activeTrigger = null

  // ── Positioning ──────────────────────────────────────────

  function positionAnchored(tooltip, trigger) {
    var rect = trigger.getBoundingClientRect()
    var tw = tooltip.offsetWidth
    var th = tooltip.offsetHeight

    // Try above first, fall back to below
    var top = rect.top - th - OFFSET
    if (top < EDGE_MARGIN) top = rect.bottom + OFFSET

    // Center horizontally, clamp to viewport
    var left = rect.left + rect.width / 2 - tw / 2
    if (left < EDGE_MARGIN) left = EDGE_MARGIN
    if (left + tw > window.innerWidth - EDGE_MARGIN) {
      left = window.innerWidth - tw - EDGE_MARGIN
    }

    tooltip.style.top = top + 'px'
    tooltip.style.left = left + 'px'
  }

  function positionAtCursor(tooltip, e) {
    var tw = tooltip.offsetWidth
    var th = tooltip.offsetHeight

    var left = e.clientX + 12
    var top = e.clientY + 12

    // Flip left if near right edge
    if (left + tw > window.innerWidth - EDGE_MARGIN) {
      left = e.clientX - tw - 12
    }
    // Flip up if near bottom edge
    if (top + th > window.innerHeight - EDGE_MARGIN) {
      top = e.clientY - th - 12
    }
    // Clamp
    if (left < EDGE_MARGIN) left = EDGE_MARGIN
    if (top < EDGE_MARGIN) top = EDGE_MARGIN

    tooltip.style.left = left + 'px'
    tooltip.style.top = top + 'px'
  }

  // ── Show / Hide ──────────────────────────────────────────

  function showTooltip(tooltip, trigger, mode) {
    // Fill callback
    var fillFn = trigger.dataset.tooltipFill
    if (fillFn && typeof window[fillFn] === 'function') {
      window[fillFn](tooltip, trigger)
    }

    tooltip.style.display = 'block'
    activeTooltip = tooltip
    activeTrigger = trigger

    if (mode === 'anchored') {
      requestAnimationFrame(function () {
        positionAnchored(tooltip, trigger)
      })
    }
  }

  function hideTooltip() {
    if (activeTooltip) {
      activeTooltip.style.display = 'none'
      activeTooltip = null
      activeTrigger = null
    }
  }

  // ── Event delegation ─────────────────────────────────────

  document.addEventListener('mouseover', function (e) {
    if (!e.target.closest) return

    // Mode 1: Anchored — .has-tooltip with child .tooltip-box
    var anchored = e.target.closest('.has-tooltip')
    if (anchored) {
      var box = anchored.querySelector('.tooltip-box')
      if (box && box !== activeTooltip) {
        hideTooltip()
        showTooltip(box, anchored, 'anchored')
      }
      return
    }

    // Mode 2: Follow cursor — data-tooltip="id"
    var follow = e.target.closest('[data-tooltip]')
    if (follow) {
      var tip = document.getElementById(follow.dataset.tooltip)
      if (tip && tip !== activeTooltip) {
        hideTooltip()
        showTooltip(tip, follow, 'follow')
      }
      return
    }
  })

  document.addEventListener('mouseout', function (e) {
    if (!e.target.closest) return

    var trigger = e.target.closest('.has-tooltip') || e.target.closest('[data-tooltip]')
    if (!trigger) return

    // Only hide if we're leaving the trigger entirely
    if (trigger.contains(e.relatedTarget)) return
    hideTooltip()
  })

  document.addEventListener('mousemove', function (e) {
    if (!activeTooltip || !activeTrigger) return
    // Only follow cursor for data-tooltip mode (not anchored)
    if (activeTrigger.classList.contains('has-tooltip')) return
    positionAtCursor(activeTooltip, e)
  })

  // ── Public API ───────────────────────────────────────────

  window.Thryft = window.Thryft || {}
  window.Thryft.tooltip = {
    /** Manually show a tooltip */
    show: function (tooltipEl, triggerEl, mode) {
      if (typeof tooltipEl === 'string') tooltipEl = document.querySelector(tooltipEl)
      if (typeof triggerEl === 'string') triggerEl = document.querySelector(triggerEl)
      if (tooltipEl && triggerEl) showTooltip(tooltipEl, triggerEl, mode || 'anchored')
    },
    /** Manually hide the active tooltip */
    hide: hideTooltip,
    /** Position a tooltip anchored to an element */
    position: positionAnchored
  }
})()
