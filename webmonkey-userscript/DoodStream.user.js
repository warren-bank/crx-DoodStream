// ==UserScript==
// @name         DoodStream
// @description  Watch videos in external player.
// @version      1.0.1
// @match        *://dood.watch/*
// @match        *://*.dood.watch/*
// @icon         https://doodstream.com/favicon.ico
// @run-at       document-end
// @grant        unsafeWindow
// @homepage     https://github.com/warren-bank/crx-DoodStream/tree/webmonkey-userscript/es5
// @supportURL   https://github.com/warren-bank/crx-DoodStream/issues
// @downloadURL  https://github.com/warren-bank/crx-DoodStream/raw/webmonkey-userscript/es5/webmonkey-userscript/DoodStream.user.js
// @updateURL    https://github.com/warren-bank/crx-DoodStream/raw/webmonkey-userscript/es5/webmonkey-userscript/DoodStream.user.js
// @namespace    warren-bank
// @author       Warren Bank
// @copyright    Warren Bank
// ==/UserScript==

// ----------------------------------------------------------------------------- constants

var user_options = {
  "common": {
    "redirect_embedded_iframes":    true,
    "force_http_video_url":         true
  },
  "webmonkey": {
    "post_intent_redirect_to_url":  "about:blank"
  },
  "greasemonkey": {
    "redirect_to_webcast_reloaded": true,
    "force_http":                   true,
    "force_https":                  false
  }
}

/*
 * *************************************
 * notes:
 *   - "force_http_video_url"
 *     * true (default)
 *       - causes the URL for the MP4 video file
 *         to be modified from HTTPS: to HTTP:
 *       - BAD for Chromecast
 *       - makes no difference for ExoAirPlayer on modern Android
 *       - NECESSARY for ExoAirPlayer on old versions of Android (ex: 4.4 KitKat),
 *         if the TLS handshake fails
 *       - the server responds to HTTP: request
 *         with a 302 redirect to HTTPS: URL,
 *         and (for some mysterious reason)
 *         ExoAirPlayer plays the MP4 video file
 *     * false
 *       - NECESSARY for Chromecast
 * *************************************
 */

// ----------------------------------------------------------------------------- helpers

// make GET request, pass plaintext response to callback
var download_text = function(url, headers, callback) {
  var xhr = new unsafeWindow.XMLHttpRequest()
  xhr.open("GET", url, true, null, null)

  if (headers && (typeof headers === 'object')) {
    var keys = Object.keys(headers)
    var key, val
    for (var i=0; i < keys.length; i++) {
      key = keys[i]
      val = headers[key]
      xhr.setRequestHeader(key, val)
    }
  }

  xhr.onload = function(e) {
    if (xhr.readyState === 4) {
      if (xhr.status === 200) {
        callback(xhr.responseText)
      }
    }
  }

  xhr.send()
}

var download_json = function(url, headers, callback) {
  download_text(url, headers, function(text){
    try {
      callback(JSON.parse(text))
    }
    catch(e) {}
  })
}

// ----------------------------------------------------------------------------- URL links to tools on Webcast Reloaded website

var get_webcast_reloaded_url = function(video_url, vtt_url, referer_url, force_http, force_https) {
  force_http  = (typeof force_http  === 'boolean') ? force_http  : user_options.greasemonkey.force_http
  force_https = (typeof force_https === 'boolean') ? force_https : user_options.greasemonkey.force_https

  var encoded_video_url, encoded_vtt_url, encoded_referer_url, webcast_reloaded_base, webcast_reloaded_url

  encoded_video_url     = encodeURIComponent(encodeURIComponent(btoa(video_url)))
  encoded_vtt_url       = vtt_url ? encodeURIComponent(encodeURIComponent(btoa(vtt_url))) : null
  referer_url           = referer_url ? referer_url : unsafeWindow.location.href
  encoded_referer_url   = encodeURIComponent(encodeURIComponent(btoa(referer_url)))

  webcast_reloaded_base = {
    "https": "https://warren-bank.github.io/crx-webcast-reloaded/external_website/index.html",
    "http":  "http://webcast-reloaded.surge.sh/index.html"
  }

  webcast_reloaded_base = (force_http)
                            ? webcast_reloaded_base.http
                            : (force_https)
                               ? webcast_reloaded_base.https
                               : (video_url.toLowerCase().indexOf('http:') === 0)
                                  ? webcast_reloaded_base.http
                                  : webcast_reloaded_base.https

  webcast_reloaded_url  = webcast_reloaded_base + '#/watch/' + encoded_video_url + (encoded_vtt_url ? ('/subtitle/' + encoded_vtt_url) : '') + '/referer/' + encoded_referer_url
  return webcast_reloaded_url
}

// ----------------------------------------------------------------------------- URL redirect

var redirect_to_url = function(url) {
  if (!url) return

  if (typeof GM_loadUrl === 'function') {
    if (typeof GM_resolveUrl === 'function')
      url = GM_resolveUrl(url, unsafeWindow.location.href) || url

    GM_loadUrl(url, 'Referer', unsafeWindow.location.href)
  }
  else {
    try {
      unsafeWindow.top.location = url
    }
    catch(e) {
      unsafeWindow.window.location = url
    }
  }
}

var process_webmonkey_post_intent_redirect_to_url = function() {
  var url = null

  if (typeof user_options.webmonkey.post_intent_redirect_to_url === 'string')
    url = user_options.webmonkey.post_intent_redirect_to_url

  if (typeof user_options.webmonkey.post_intent_redirect_to_url === 'function')
    url = user_options.webmonkey.post_intent_redirect_to_url()

  if (typeof url === 'string')
    redirect_to_url(url)
}

var process_video_url = function(video_url, video_type, vtt_url, referer_url) {
  if (!video_url)
    return

  if (!referer_url)
    referer_url = unsafeWindow.location.href

  if (typeof GM_startIntent === 'function') {
    // running in Android-WebMonkey: open Intent chooser

    var args = [
      /* action = */ 'android.intent.action.VIEW',
      /* data   = */ video_url,
      /* type   = */ video_type
    ]

    // extras:
    if (vtt_url) {
      args.push('textUrl')
      args.push(vtt_url)
    }
    if (referer_url) {
      args.push('referUrl')
      args.push(referer_url)
    }

    GM_startIntent.apply(this, args)
    process_webmonkey_post_intent_redirect_to_url()
    return true
  }
  else if (user_options.greasemonkey.redirect_to_webcast_reloaded) {
    // running in standard web browser: redirect URL to top-level tool on Webcast Reloaded website

    redirect_to_url(get_webcast_reloaded_url(video_url, vtt_url, referer_url))
    return true
  }
  else {
    return false
  }
}

var process_hls_url = function(hls_url, vtt_url, referer_url) {
  process_video_url(/* video_url= */ hls_url, /* video_type= */ 'application/x-mpegurl', vtt_url, referer_url)
}

var process_dash_url = function(dash_url, vtt_url, referer_url) {
  process_video_url(/* video_url= */ dash_url, /* video_type= */ 'application/dash+xml', vtt_url, referer_url)
}

var process_mp4_url = function(mp4_url, vtt_url, referer_url) {
  process_video_url(/* video_url= */ mp4_url, /* video_type= */ 'video/mp4', vtt_url, referer_url)
}

// ----------------------------------------------------------------------------- process page: outer

var process_video_outer = function() {
  var iframe = unsafeWindow.document.querySelector('iframe[allowfullscreen][src]')
  if (!iframe) return

  var url = iframe.getAttribute('src')
  redirect_to_url(url)
}

// ----------------------------------------------------------------------------- process page: inner

var resolve_url = function(url) {
  if (url.substring(0, 4).toLowerCase() === 'http')
    return url

  if (url.substring(0, 2) === '//')
    return unsafeWindow.location.protocol + url

  if (url.substring(0, 1) === '/')
    return unsafeWindow.location.protocol + '//' + unsafeWindow.location.host + url

  return unsafeWindow.location.protocol + '//' + unsafeWindow.location.host + unsafeWindow.location.pathname.replace(/[^\/]+$/, '') + url
}

var process_video_inner = function() {
  var regex, scripts, script, xhr_url, token, callback

  regex = {
    whitespace: /[\r\n\t]+/g,
    xhr_url:    /^.*['"](\/pass_md5\/[^'"]+)['"].*$/,
    token:      /^.*\+['"](\?token=[^'"]+&expiry=)['"].*$/
  }

  scripts = unsafeWindow.document.querySelectorAll('script:not([src])')

  for (var i=0; i < scripts.length; i++) {
    script = scripts[i]
    script = script.innerHTML
    script = script.replace(regex.whitespace, ' ')

    if (regex.xhr_url.test(script) && regex.token.test(script)) {
      xhr_url = script.replace(regex.xhr_url, '$1')
      token   = script.replace(regex.token,   '$1')

      callback = function(text) {
        var mp4_url

        if (!text) return
        text = text.trim()
        if (!text) return

        mp4_url  = text + 'XXXXXXXXXX' + token + Date.now()
        mp4_url  = resolve_url(mp4_url)
        mp4_url += '#video.mp4'

        if (user_options.common.force_http_video_url && (mp4_url.substring(0,6).toLowerCase() === 'https:'))
          mp4_url = 'http:' + mp4_url.substring(6, mp4_url.length)

        process_mp4_url(mp4_url)
      }

      download_text(xhr_url, /* headers= */ null, callback)
      break
    }
  }
}

// ----------------------------------------------------------------------------- bootstrap

var is_video_outer = (unsafeWindow.location.pathname.indexOf('/d/') === 0)
var is_video_inner = (unsafeWindow.location.pathname.indexOf('/e/') === 0)

var should_process_page = function() {
  return is_video_outer || is_video_inner
}

var should_process_window = function() {
  var is_top = (unsafeWindow.window === unsafeWindow.top)

  return is_top || user_options.common.redirect_embedded_iframes
}

var should_init = function() {
  return should_process_page() && should_process_window()
}

var init = function() {
  if (is_video_outer)
    return process_video_outer()

  if (is_video_inner)
    return process_video_inner()
}

if (should_init())
  init()

// -----------------------------------------------------------------------------
