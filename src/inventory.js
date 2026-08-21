/**
 * Thryft Inventory — grid with drag/drop, context menu, and tooltips
 *
 * Handles inventory grids common in MMOs and idle games: drag-to-reorder,
 * right-click context menus, and item tooltips. Supports both mouse and
 * touch input.
 *
 * Usage:
 *   <div data-inventory data-reorder-url="/game/inventory/reorder">
 *     <div class="inv-cell" data-item-key="iron_ore" draggable="true"
 *          data-name="Iron Ore" data-quantity="24" data-max-stack="99"
 *          data-description="Common mining material"
 *          data-actions="track,open">
 *       <img src="/img/iron_ore.png">
 *     </div>
 *     <div class="inv-cell"></div>  <!-- empty slot -->
 *   </div>
 *
 * Context menu actions fire a custom event:
 *   document.addEventListener('thryft:inventory-action', function(e) {
 *     // e.detail = { action: 'open', key: 'chest_wood', cell: <element> }
 *   })
 *
 * Reorder sends POST { fromKey, toKey } to the data-reorder-url and
 * fires thryft:inventory-reorder event on completion.
 */
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
