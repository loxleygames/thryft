/**
 * Thryft Sound — audio preloading and playback
 *
 * Manages game sound effects with lazy preloading (on first user
 * interaction) and a global mute toggle backed by localStorage.
 *
 * Usage:
 *   Thryft.sound.register({
 *     bell:     { src: '/audio/bell.mp3', vol: 0.4 },
 *     fanfare:  { src: '/audio/fanfare.mp3', vol: 0.5 },
 *     cannon:   { src: '/audio/cannon.mp3', vol: 0.6 },
 *   })
 *
 *   Thryft.sound.play('bell')
 *   Thryft.sound.toggle()          // mute/unmute
 *   Thryft.sound.isEnabled()       // check state
 *
 * Integrates with Thryft Timer — use data-sound="bell" on timer
 * elements to play a sound on completion.
 */
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
