/**
 * Thryft Cost — live affordability tracking for build/craft/research cards
 *
 * Reads current resource values from Thryft Timer resource elements,
 * updates cost displays, and toggles build buttons when affordable.
 *
 * Usage — cost display:
 *   <span data-cost="timber" data-cost-need="200">
 *     <span data-cost-have></span>/200
 *   </span>
 *
 * Usage — with visual ring (SVG radial progress):
 *   <span data-cost="timber" data-cost-need="200">
 *     <svg>
 *       <circle data-cost-ring .../>  <!-- stroke + dashoffset updated -->
 *     </svg>
 *     <span data-cost-have></span>/<span data-cost-total></span>
 *   </span>
 *
 * Usage — build button toggle:
 *   <div data-cost-card>
 *     <span data-cost="timber" data-cost-need="200"></span>
 *     <span data-cost="iron" data-cost-need="100"></span>
 *     <div data-cost-affordable style="display:none">
 *       <button>Build</button>
 *     </div>
 *     <div data-cost-unaffordable>
 *       <button disabled>Cannot afford</button>
 *     </div>
 *   </div>
 *
 * Resource values are read from elements matching:
 *   [data-timer-resource][data-res] with child [data-timer-resource-value]
 * (i.e. Thryft Timer resource ticking elements)
 *
 * Config:
 *   data-cost             Resource key (e.g. "timber", "iron")
 *   data-cost-need        Amount required
 *   data-cost-have        Element to display current amount (auto-updated)
 *   data-cost-total       Element to display required amount
 *   data-cost-ring        SVG circle element — stroke colour + dashoffset updated
 *   data-cost-card        Container for a group of costs + affordability toggle
 *   data-cost-affordable  Shown when all costs in the card are met
 *   data-cost-unaffordable Shown when any cost in the card is not met
 */
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
