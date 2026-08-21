/**
 * Thryft Fetch — DOM-diffing HTML swap engine
 *
 * Drop-in HTMX replacement for server-rendered games.
 * Fetches HTML from endpoints and patches the DOM via diffing
 * instead of tearing down and rebuilding subtrees.
 *
 * Usage:
 *   <div data-fetch="/game/resources" data-interval="30000" data-swap="inner">
 *   <div data-fetch="/game/activity" data-trigger="load" data-swap="inner">
 *   <button data-fetch="/game/inventory" data-target="#modal" data-swap="inner">
 *   <span data-fetch="/game/badge" data-interval="15000" data-onswap="onBadge">
 */
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
