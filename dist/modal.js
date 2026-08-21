/**
 * Thryft Modal — lightbox/overlay system
 *
 * Consistent modal management: open, close, Escape key, click-outside,
 * scroll lock, and stacking.
 *
 * Usage (load content from server):
 *   <button data-modal-fetch="/game/news" data-modal-target="#game-modal">
 *     News
 *   </button>
 *   <div id="game-modal" class="thryft-modal"></div>
 *
 * Usage (toggle existing content):
 *   <button data-modal-toggle="#settings-modal">Settings</button>
 *   <div id="settings-modal" class="thryft-modal" style="display:none">
 *     <div class="thryft-modal-backdrop"></div>
 *     <div class="thryft-modal-content">...</div>
 *   </div>
 *
 * Usage (programmatic):
 *   Thryft.modal.open('#my-modal')
 *   Thryft.modal.open('#my-modal', '/game/inventory')  // fetch + open
 *   Thryft.modal.close('#my-modal')
 *   Thryft.modal.close()  // close topmost
 */
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
