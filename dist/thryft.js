/**
 * Thryft v0.2.0 — Game UI toolkit
 * https://github.com/loxleygames/thryft
 * License: MIT
 */

// ── fetch ──
;(function () {
  'use strict'

  var timers = new Map()

  // ── Diff engine ──────────────────────────────────────────

  function diffAttributes(oldEl, newEl) {
    var oldAttrs = oldEl.attributes
    var newAttrs = newEl.attributes

    // Remove attributes not in new element
    for (var i = oldAttrs.length - 1; i >= 0; i--) {
      if (!newEl.hasAttribute(oldAttrs[i].name)) {
        oldEl.removeAttribute(oldAttrs[i].name)
      }
    }
    // Set new/changed attributes
    for (var j = 0; j < newAttrs.length; j++) {
      var attr = newAttrs[j]
      if (oldEl.getAttribute(attr.name) !== attr.value) {
        oldEl.setAttribute(attr.name, attr.value)
      }
    }
  }

  function diffChildren(parent, newParent) {
    var oldNodes = Array.from(parent.childNodes)
    var newNodes = Array.from(newParent.childNodes)
    var max = Math.max(oldNodes.length, newNodes.length)

    for (var i = 0; i < max; i++) {
      var oldNode = oldNodes[i]
      var newNode = newNodes[i]

      if (!newNode) {
        // Extra old node — remove
        parent.removeChild(oldNode)
        continue
      }

      if (!oldNode) {
        // Extra new node — append
        parent.appendChild(newNode.cloneNode(true))
        continue
      }

      // Different node type or tag — replace
      if (oldNode.nodeType !== newNode.nodeType || oldNode.nodeName !== newNode.nodeName) {
        parent.replaceChild(newNode.cloneNode(true), oldNode)
        continue
      }

      // Text node — patch content
      if (oldNode.nodeType === 3) {
        if (oldNode.textContent !== newNode.textContent) {
          oldNode.textContent = newNode.textContent
        }
        continue
      }

      // Element node — diff attributes then recurse
      if (oldNode.nodeType === 1) {
        diffAttributes(oldNode, newNode)
        diffChildren(oldNode, newNode)
      }
    }
  }

  function diffSwap(target, html) {
    var tpl = document.createElement('template')
    tpl.innerHTML = html
    diffChildren(target, tpl.content)
  }

  // ── Fetch + swap ─────────────────────────────────────────

  function fetchAndSwap(source) {
    var url = source.dataset.fetch
    var targetEl = source.dataset.target
      ? document.querySelector(source.dataset.target)
      : source
    if (!targetEl) return

    var oldHtml = targetEl.innerHTML

    fetch(url, { credentials: 'same-origin' })
      .then(function (res) {
        if (!res.ok) return null
        return res.text()
      })
      .then(function (html) {
        if (html === null) return

        var swap = source.dataset.swap || 'inner'
        if (swap === 'inner') {
          diffSwap(targetEl, html)
        } else if (swap === 'outer') {
          // Outer swap — replace entire element. Can't diff this meaningfully
          // since the root element itself may have changed.
          var tpl = document.createElement('template')
          tpl.innerHTML = html
          var newEl = tpl.content.firstElementChild
          if (newEl) {
            targetEl.parentNode.replaceChild(newEl, targetEl)
            // Re-setup the new element if it has data-fetch
            if (newEl.dataset.fetch) setup(newEl)
            newEl.querySelectorAll('[data-fetch]').forEach(setup)
          }
        }

        // Callback hook
        var cb = source.dataset.onswap
        if (cb && typeof window[cb] === 'function') {
          window[cb](targetEl, html, oldHtml)
        }

        // Dispatch event for other modules to hook into
        targetEl.dispatchEvent(new CustomEvent('thryft:swap', {
          bubbles: true,
          detail: { target: targetEl, html: html, oldHtml: oldHtml }
        }))
      })
      .catch(function () {
        // Silently ignore network errors — next poll will retry
      })
  }

  // ── Setup ────────────────────────────────────────────────

  function setup(el) {
    if (timers.has(el)) return

    var trigger = el.dataset.trigger
    var interval = parseInt(el.dataset.interval)

    // Load trigger — fetch immediately
    if (trigger === 'load') {
      fetchAndSwap(el)
    }

    // Interval polling
    if (interval > 0) {
      // Also fetch immediately on first poll setup
      if (trigger !== 'load') fetchAndSwap(el)
      var id = setInterval(function () { fetchAndSwap(el) }, interval)
      timers.set(el, id)
    }

    // Click trigger — buttons/links that load content into a target
    if (!trigger && !interval) {
      el.addEventListener('click', function (e) {
        e.preventDefault()
        fetchAndSwap(el)
      })
    }
  }

  function init() {
    document.querySelectorAll('[data-fetch]').forEach(setup)

    // Watch for dynamically added elements
    new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var added = mutations[i].addedNodes
        for (var j = 0; j < added.length; j++) {
          var node = added[j]
          if (node.nodeType !== 1) continue
          if (node.dataset && node.dataset.fetch) setup(node)
          if (node.querySelectorAll) {
            node.querySelectorAll('[data-fetch]').forEach(setup)
          }
        }
      }
    }).observe(document.body, { childList: true, subtree: true })
  }

  // ── Public API ───────────────────────────────────────────

  window.Thryft = window.Thryft || {}
  window.Thryft.fetch = {
    /** Manually trigger a fetch on an element */
    refresh: function (el) {
      if (typeof el === 'string') el = document.querySelector(el)
      if (el) fetchAndSwap(el)
    },
    /** Manually diff-swap HTML into a target element */
    swap: function (target, html) {
      if (typeof target === 'string') target = document.querySelector(target)
      if (target) diffSwap(target, html)
    },
    /** Stop polling for an element */
    stop: function (el) {
      if (typeof el === 'string') el = document.querySelector(el)
      if (el && timers.has(el)) {
        clearInterval(timers.get(el))
        timers.delete(el)
      }
    }
  }

  document.addEventListener('DOMContentLoaded', init)
})()

// ── tooltip ──
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

// ── timer ──
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

// ── sound ──
;(function () {
  'use strict'

  var STORAGE_KEY = 'thryft_sound'
  var sounds = {}
  var loaded = false

  // ── Preload ──────────────────────────────────────────────

  function preload() {
    if (loaded) return
    loaded = true
    for (var key in sounds) {
      var def = sounds[key]
      if (def._audio) continue
      var a = new Audio()
      a.preload = 'auto'
      a.volume = def.vol || 0.5
      a.src = def.src
      def._audio = a
    }
  }

  // Preload on first user interaction
  document.addEventListener('click', preload, { once: true })
  document.addEventListener('touchstart', preload, { once: true })
  document.addEventListener('keydown', preload, { once: true })

  // ── Playback ─────────────────────────────────────────────

  function play(key) {
    if (!isEnabled()) return
    preload()
    var def = sounds[key]
    if (!def || !def._audio) return
    var a = def._audio
    if (!a.paused) a.pause()
    a.currentTime = 0
    a.play().catch(function () {})
  }

  // ── Toggle ───────────────────────────────────────────────

  function isEnabled() {
    return localStorage.getItem(STORAGE_KEY) === 'on'
  }

  function setEnabled(on) {
    localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off')
  }

  function toggle() {
    setEnabled(!isEnabled())
    return isEnabled()
  }

  // ── Registration ─────────────────────────────────────────

  function register(defs) {
    for (var key in defs) {
      sounds[key] = { src: defs[key].src, vol: defs[key].vol || 0.5, _audio: null }
    }
    // If already preloaded, load the new ones too
    if (loaded) {
      for (var k in defs) {
        if (!sounds[k]._audio) {
          var a = new Audio()
          a.preload = 'auto'
          a.volume = sounds[k].vol
          a.src = sounds[k].src
          sounds[k]._audio = a
        }
      }
    }
  }

  // ── Public API ───────────────────────────────────────────

  window.Thryft = window.Thryft || {}
  window.Thryft.sound = {
    register: register,
    play: play,
    isEnabled: isEnabled,
    setEnabled: setEnabled,
    toggle: toggle
  }
})()

// ── modal ──
;(function () {
  'use strict'

  var stack = [] // open modals, most recent last

  // ── Open / Close ─────────────────────────────────────────

  function open(modal, fetchUrl) {
    if (typeof modal === 'string') modal = document.querySelector(modal)
    if (!modal) return

    if (fetchUrl) {
      fetch(fetchUrl, { credentials: 'same-origin' })
        .then(function (res) { return res.ok ? res.text() : null })
        .then(function (html) {
          if (html === null) return
          // If modal has a .thryft-modal-content container, fill that
          var content = modal.querySelector('.thryft-modal-content')
          if (content) {
            content.innerHTML = html
          } else {
            modal.innerHTML = html
          }
          reveal(modal)
        })
        .catch(function () {})
      return
    }

    reveal(modal)
  }

  function reveal(modal) {
    modal.style.display = 'flex'
    modal.classList.add('thryft-modal-open')
    stack.push(modal)
    document.body.classList.add('thryft-modal-active')

    modal.dispatchEvent(new CustomEvent('thryft:modal-open', { bubbles: true }))
  }

  function close(modal) {
    if (!modal && stack.length > 0) {
      modal = stack[stack.length - 1]
    }
    if (typeof modal === 'string') modal = document.querySelector(modal)
    if (!modal) return

    modal.style.display = 'none'
    modal.classList.remove('thryft-modal-open')

    var idx = stack.indexOf(modal)
    if (idx !== -1) stack.splice(idx, 1)

    if (stack.length === 0) {
      document.body.classList.remove('thryft-modal-active')
    }

    modal.dispatchEvent(new CustomEvent('thryft:modal-close', { bubbles: true }))
  }

  // ── Event delegation ─────────────────────────────────────

  document.addEventListener('click', function (e) {
    // Close button
    var closeBtn = e.target.closest('[data-modal-close]')
    if (closeBtn) {
      var target = closeBtn.dataset.modalClose
      close(target || undefined)
      return
    }

    // Fetch + open button
    var fetchBtn = e.target.closest('[data-modal-fetch]')
    if (fetchBtn) {
      e.preventDefault()
      var url = fetchBtn.dataset.modalFetch
      var modalSel = fetchBtn.dataset.modalTarget
      open(modalSel, url)
      return
    }

    // Toggle button
    var toggleBtn = e.target.closest('[data-modal-toggle]')
    if (toggleBtn) {
      e.preventDefault()
      var modal = document.querySelector(toggleBtn.dataset.modalToggle)
      if (modal) {
        if (modal.style.display === 'none' || !modal.classList.contains('thryft-modal-open')) {
          open(modal)
        } else {
          close(modal)
        }
      }
      return
    }

    // Click on backdrop to close
    if (e.target.classList.contains('thryft-modal-backdrop') ||
        (e.target.classList.contains('thryft-modal') && e.target === e.target)) {
      // Check if the click is directly on the modal overlay (not its content)
      var modal = e.target.closest('.thryft-modal')
      if (modal && e.target === modal) {
        close(modal)
      } else if (e.target.classList.contains('thryft-modal-backdrop')) {
        close(e.target.closest('.thryft-modal'))
      }
    }
  })

  // Escape to close topmost
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && stack.length > 0) {
      close()
    }
  })

  // ── Public API ───────────────────────────────────────────

  window.Thryft = window.Thryft || {}
  window.Thryft.modal = {
    open: open,
    close: close,
    /** Returns the topmost open modal or null */
    current: function () { return stack.length > 0 ? stack[stack.length - 1] : null },
    /** Returns true if any modal is open */
    isOpen: function () { return stack.length > 0 }
  }
})()

// ── inventory ──
;(function () {
  'use strict'

  var dragKey = null
  var touchDragKey = null
  var touchDragEl = null

  // ── Context Menu ─────────────────────────────────────────

  var ctxMenu = null

  function getOrCreateCtxMenu() {
    if (ctxMenu) return ctxMenu
    ctxMenu = document.createElement('div')
    ctxMenu.className = 'thryft-context-menu'
    ctxMenu.style.display = 'none'
    ctxMenu.style.position = 'fixed'
    ctxMenu.style.zIndex = '10000'
    document.body.appendChild(ctxMenu)
    return ctxMenu
  }

  function showContextMenu(cell, e) {
    var menu = getOrCreateCtxMenu()
    var actions = (cell.dataset.actions || '').split(',').filter(Boolean)
    if (actions.length === 0) return

    var key = cell.dataset.itemKey
    var html = ''

    for (var i = 0; i < actions.length; i++) {
      var action = actions[i].trim()
      var label = action.charAt(0).toUpperCase() + action.slice(1)
      html += '<button class="thryft-ctx-item" data-action="' + action + '" data-key="' + key + '">' + label + '</button>'
    }

    menu.innerHTML = html
    menu.style.display = 'block'

    // Position near click
    var top = e.clientY
    var left = e.clientX
    // Defer to get menu dimensions
    requestAnimationFrame(function () {
      if (top + menu.offsetHeight > window.innerHeight - 4) {
        top = window.innerHeight - menu.offsetHeight - 4
      }
      if (left + menu.offsetWidth > window.innerWidth - 4) {
        left = window.innerWidth - menu.offsetWidth - 4
      }
      menu.style.top = top + 'px'
      menu.style.left = left + 'px'
    })
  }

  function hideContextMenu() {
    if (ctxMenu) ctxMenu.style.display = 'none'
  }

  // ── Reorder ──────────────────────────────────────────────

  function reorder(inventory, fromKey, toKey) {
    var url = inventory.dataset.reorderUrl
    if (!url) return

    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ fromKey: fromKey, toKey: toKey })
    }).then(function () {
      inventory.dispatchEvent(new CustomEvent('thryft:inventory-reorder', {
        bubbles: true,
        detail: { fromKey: fromKey, toKey: toKey }
      }))
    })
  }

  // ── Mouse drag ───────────────────────────────────────────

  document.addEventListener('dragstart', function (e) {
    var cell = e.target.closest('[data-inventory] .inv-cell[data-item-key]')
    if (!cell) return
    dragKey = cell.dataset.itemKey
    cell.classList.add('inv-dragging')
    e.dataTransfer.effectAllowed = 'move'
  })

  document.addEventListener('dragover', function (e) {
    var cell = e.target.closest('[data-inventory] .inv-cell')
    if (!cell) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    cell.classList.add('inv-dragover')
  })

  document.addEventListener('dragleave', function (e) {
    var cell = e.target.closest('[data-inventory] .inv-cell')
    if (cell) cell.classList.remove('inv-dragover')
  })

  document.addEventListener('drop', function (e) {
    e.preventDefault()
    var cell = e.target.closest('[data-inventory] .inv-cell[data-item-key]')
    if (!cell || !dragKey) return
    cell.classList.remove('inv-dragover')

    var toKey = cell.dataset.itemKey
    if (toKey === dragKey) return

    var inventory = cell.closest('[data-inventory]')
    if (inventory) reorder(inventory, dragKey, toKey)
  })

  document.addEventListener('dragend', function () {
    dragKey = null
    document.querySelectorAll('.inv-dragging').forEach(function (el) {
      el.classList.remove('inv-dragging')
    })
    document.querySelectorAll('.inv-dragover').forEach(function (el) {
      el.classList.remove('inv-dragover')
    })
  })

  // ── Touch drag ───────────────────────────────────────────

  document.addEventListener('touchstart', function (e) {
    var cell = e.target.closest('[data-inventory] .inv-cell[data-item-key]')
    if (!cell) return
    touchDragKey = cell.dataset.itemKey
    touchDragEl = cell
    cell.classList.add('inv-dragging')
  }, { passive: true })

  document.addEventListener('touchmove', function (e) {
    if (!touchDragKey) return
    var touch = e.touches[0]
    var el = document.elementFromPoint(touch.clientX, touch.clientY)
    var cell = el && el.closest ? el.closest('[data-inventory] .inv-cell') : null

    document.querySelectorAll('.inv-dragover').forEach(function (el) {
      el.classList.remove('inv-dragover')
    })
    if (cell && cell.dataset.itemKey && cell.dataset.itemKey !== touchDragKey) {
      cell.classList.add('inv-dragover')
    }
  }, { passive: true })

  document.addEventListener('touchend', function () {
    if (!touchDragKey) return

    var overCell = document.querySelector('.inv-dragover')
    if (overCell && overCell.dataset.itemKey) {
      var inventory = overCell.closest('[data-inventory]')
      if (inventory) reorder(inventory, touchDragKey, overCell.dataset.itemKey)
    }

    if (touchDragEl) touchDragEl.classList.remove('inv-dragging')
    document.querySelectorAll('.inv-dragover').forEach(function (el) {
      el.classList.remove('inv-dragover')
    })
    touchDragKey = null
    touchDragEl = null
  })

  // ── Click delegation ─────────────────────────────────────

  document.addEventListener('click', function (e) {
    // Context menu action clicked
    var ctxItem = e.target.closest('.thryft-ctx-item')
    if (ctxItem) {
      hideContextMenu()
      document.dispatchEvent(new CustomEvent('thryft:inventory-action', {
        detail: {
          action: ctxItem.dataset.action,
          key: ctxItem.dataset.key,
          cell: document.querySelector('.inv-cell[data-item-key="' + ctxItem.dataset.key + '"]')
        }
      }))
      return
    }

    // Click outside context menu — close it
    if (ctxMenu && ctxMenu.style.display !== 'none' && !e.target.closest('.thryft-context-menu')) {
      hideContextMenu()
    }
  })

  // Right-click on inventory cell — show context menu
  document.addEventListener('contextmenu', function (e) {
    var cell = e.target.closest('[data-inventory] .inv-cell[data-item-key]')
    if (!cell) return
    if (!(cell.dataset.actions || '').trim()) return
    e.preventDefault()
    showContextMenu(cell, e)
  })

  // ── Public API ───────────────────────────────────────────

  window.Thryft = window.Thryft || {}
  window.Thryft.inventory = {
    /** Show context menu for an inventory cell */
    showMenu: showContextMenu,
    /** Hide the context menu */
    hideMenu: hideContextMenu
  }
})()

// ── cost ──
;(function () {
  'use strict'

  var TICK_MS = 2000
  var COLOR_MET = '#4a8c4a'
  var COLOR_UNMET = '#8b3a3a'

  // ── Read resource values ────────────────────────────────

  function getResourceValues() {
    var values = {}
    document.querySelectorAll('[data-timer-resource][data-res]').forEach(function (el) {
      var valEl = el.querySelector('[data-timer-resource-value]')
      if (valEl) {
        values[el.dataset.res] = parseFloat(valEl.textContent.replace(/,/g, '')) || 0
      }
    })
    return values
  }

  // ── Format ──────────────────────────────────────────────

  function fmt(n) {
    return Math.floor(n).toLocaleString('en-GB')
  }

  // ── Update costs ────────────────────────────────────────

  function tick() {
    var res = getResourceValues()
    if (Object.keys(res).length === 0) return

    // Update individual cost elements
    document.querySelectorAll('[data-cost]').forEach(function (el) {
      var key = el.dataset.cost
      var need = parseFloat(el.dataset.costNeed) || 0
      var have = res[key]
      if (have === undefined) return

      var pct = Math.min(100, (have / need) * 100)
      var met = have >= need

      // Update have display
      var haveEl = el.querySelector('[data-cost-have]')
      if (haveEl) haveEl.textContent = fmt(have)

      // Update total display
      var totalEl = el.querySelector('[data-cost-total]')
      if (totalEl) totalEl.textContent = fmt(need)

      // Update ring if present
      var ring = el.querySelector('[data-cost-ring]')
      if (ring) {
        var r = parseFloat(ring.getAttribute('r')) || 14
        var circ = 2 * Math.PI * r
        ring.setAttribute('stroke', met ? COLOR_MET : COLOR_UNMET)
        ring.setAttribute('stroke-dashoffset', circ - (circ * pct / 100))
      }

      // Mark element
      if (met) {
        el.classList.remove('cost-unmet')
        el.classList.add('cost-met')
      } else {
        el.classList.remove('cost-met')
        el.classList.add('cost-unmet')
      }
    })

    // Toggle build buttons per card
    document.querySelectorAll('[data-cost-card]').forEach(function (card) {
      var costs = card.querySelectorAll('[data-cost]')
      var canAfford = true

      costs.forEach(function (el) {
        var key = el.dataset.cost
        var need = parseFloat(el.dataset.costNeed) || 0
        var have = res[key]
        if (have === undefined) return
        if (have < need) canAfford = false
      })

      var affordable = card.querySelector('[data-cost-affordable]')
      var unaffordable = card.querySelector('[data-cost-unaffordable]')

      if (affordable) affordable.style.display = canAfford ? '' : 'none'
      if (unaffordable) unaffordable.style.display = canAfford ? 'none' : ''
    })
  }

  // ── Tick loop ───────────────────────────────────────────

  setInterval(tick, TICK_MS)

  // Tick after fetch swaps
  document.addEventListener('thryft:swap', tick)
  document.addEventListener('DOMContentLoaded', tick)

  // ── Public API ──────────────────────────────────────────

  window.Thryft = window.Thryft || {}
  window.Thryft.cost = {
    /** Manually trigger a cost update */
    tick: tick,
    /** Get current resource values */
    getResources: getResourceValues,
    /** Customise met/unmet colours */
    setColors: function (met, unmet) {
      COLOR_MET = met
      COLOR_UNMET = unmet
    }
  }
})()
