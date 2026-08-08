/**
 * Tracer SDK — paste this before </body> in your HTML
 * Replace TRACER_KEY with your project's API key from Settings.
 */
(function () {
  var TRACER_KEY = 'YOUR_PROJECT_API_KEY'
  var TRACER_URL = 'https://YOUR_API_URL'

  function send(msg, stack) {
    fetch(TRACER_URL + '/api/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': TRACER_KEY },
      body: JSON.stringify({
        message: msg,
        stack: stack || null,
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
      }),
    }).catch(function () {}) // never break the host app
  }

  window.onerror = function (msg, _src, _line, _col, err) {
    send(typeof msg === 'string' ? msg : 'Unknown error', err ? err.stack : null)
  }

  window.addEventListener('unhandledrejection', function (e) {
    var msg = e.reason instanceof Error ? e.reason.message : String(e.reason)
    var stack = e.reason instanceof Error ? e.reason.stack : null
    send(msg, stack)
  })
})()
