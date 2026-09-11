/**
 * Thryft.tmpl — Data-bound HTML templates.
 *
 * Define <template> elements with data-bind attributes in your HTML.
 * Stamp instances with Thryft.tmpl('template-id', { key: value }).
 *
 * Binding syntax (space-separated on data-bind attribute):
 *   text:key      → el.textContent = data[key]
 *   src:key       → el.src = data[key]
 *   href:key      → el.href = data[key]
 *   value:key     → el.value = data[key]
 *   class:key     → el.classList.add(data[key])
 *   style.X:key   → el.style[X] = data[key]
 *   attr.X:key    → el.setAttribute(X, data[key])
 *   html:key      → el.innerHTML = data[key] (use sparingly)
 *
 * Example:
 *   <template id="tmpl-user">
 *     <div class="user-card">
 *       <img data-bind="src:avatar" />
 *       <span data-bind="text:name"></span>
 *     </div>
 *   </template>
 *
 *   var card = Thryft.tmpl('tmpl-user', { avatar: '/img/rob.png', name: 'Rob' });
 *   document.body.appendChild(card);
 */
;(function () {
  'use strict'

  function stamp(id, data) {
    var t = document.getElementById(id)
    if (!t) return document.createElement('div')
    var clone = t.content.cloneNode(true)
    var root = clone.firstElementChild || clone
    if (data) {
      var els = root.querySelectorAll
        ? [root].concat(Array.from(root.querySelectorAll('[data-bind]')))
        : [root]
      for (var i = 0; i < els.length; i++) {
        var el = els[i]
        var bind = el.getAttribute && el.getAttribute('data-bind')
        if (!bind) continue
        var pairs = bind.split(/\s+/)
        for (var j = 0; j < pairs.length; j++) {
          var parts = pairs[j].split(':')
          if (parts.length < 2) continue
          var prop = parts[0], key = parts[1]
          var val = data[key]
          if (val === undefined || val === null) continue
          if (prop === 'text') el.textContent = val
          else if (prop === 'src') el.src = val
          else if (prop === 'href') el.href = val
          else if (prop === 'value') el.value = val
          else if (prop === 'class') el.classList.add(val)
          else if (prop === 'html') el.innerHTML = val
          else if (prop.indexOf('style.') === 0) el.style[prop.slice(6)] = val
          else if (prop.indexOf('attr.') === 0) el.setAttribute(prop.slice(5), val)
        }
        el.removeAttribute('data-bind')
      }
    }
    return root
  }

  window.Thryft = window.Thryft || {}
  window.Thryft.tmpl = stamp
})()
