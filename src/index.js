var LeafletGeoSearch = require('leaflet-geosearch')

var OverpassLayer = require('overpass-layer')
var OverpassLayerList = require('overpass-layer').List
var OverpassFrontend = require('overpass-frontend')
var OpenStreetBrowserLoader = require('./OpenStreetBrowserLoader')
var hash = require('sheet-router/hash')
var queryString = require('query-string')
window.OpenStreetBrowserLoader = OpenStreetBrowserLoader

require('./CategoryIndex')
require('./CategoryOverpass')

global.map
window.baseCategory
window.overpassUrl
window.overpassFrontend
var state = {}

// Optional modules
require('./options')
require('./language')
require('./location')
require('./overpassChooser')
require('./fullscreen')
require('./mapLayers')
require('./twigFunctions')

window.onload = function() {
  map = L.map('map')

  call_hooks('init')
  call_hooks_callback('init_callback', onload2)
}

function onload2 () {
  // Add Geo Search
  var provider = new LeafletGeoSearch.OpenStreetMapProvider()
  var searchControl = new LeafletGeoSearch.GeoSearchControl({
    provider: provider,
    showMarker: false,
    retainZoomLevel: true
  })
  map.addControl(searchControl)

  // Geo location
  L.control.locate({
    keepCurrentZoomLevel: true,
    drawCircle: false,
    drawMarker: false,
    showPopup: false
  }).addTo(map);

  if (typeof overpassUrl === 'undefined') {
    overpassUrl = config.overpassUrl
    if (Array.isArray(overpassUrl) && overpassUrl.length) {
      overpassUrl = overpassUrl[0]
    }
  }

  overpassFrontend = new OverpassFrontend(overpassUrl, {
    timeGap: 10,
    effortPerRequest: 100
  })

  OpenStreetBrowserLoader.setMap(map)

  OpenStreetBrowserLoader.getCategory('index', function (err, category) {
    if (err) {
      alert(err)
      return
    }

    baseCategory = category
    category.setParentDom(document.getElementById('contentList'))
    category.open()
  })

  map.on('popupopen', function (e) {
    if (e.popup.object) {
      var url = e.popup.object.layer_id + '/' + e.popup.object.id
      if (location.hash.substr(1) !== url && location.hash.substr(1, url.length + 1) !== url + '/' ) {

        state.path = url
        updateState(true)
      }

      OpenStreetBrowserLoader.getCategory(e.popup.object.layer_id, function (err, category) {
        category.notifyPopupOpen(e.popup.object, e.popup)

      })
    }
  })
  map.on('popupclose', function (e) {
    delete state.path
    updateState(true)
    hide()
  })

  if (location.hash && location.hash.length > 1) {
    readState(location.hash.substr(1))
  }

  hash(function (loc) {
    readState(loc.substr(1))
  })
}

function readState (url) {
  options = {
    showDetails: !!url.match(/\/details$/)
  }

  show(url, options, function (err) {
    if (err) {
      alert(err)
      return
    }

    call_hooks('show', url, options)
  })
}

function updateState (push) {
  var tmpState = JSON.parse(JSON.stringify(state))
  var path = tmpState.path
  delete tmpState.path

  var newHash = queryString.stringify(tmpState)

  if (typeof path === 'undefined') {
    newHash = '#' + newHash
  } else {
    newHash = '#' + path + (newHash !== '' ? '&' + newHash : '')
  }

  newHash = newHash.replace(/%2F/g, '/')

  if (push) {
    history.pushState(null, null, newHash)
  } else if (location.hash !== newHash && (location.hash !== '' || newHash !== '#')) {
    history.replaceState(null, null, newHash)
  }
}

function show (id, options, callback) {
  if (options.showDetails) {
    document.getElementById('content').className = 'details'
    document.getElementById('contentDetails').innerHTML = 'Loading ...'
  }

  id = id.split('/')

  if (id.length < 2) {
    return callback('unknown request')
  }

  OpenStreetBrowserLoader.getCategory(id[0], function (err, category) {
    if (err) {
      return callback('error loading category "' + id[0] + '": ' + err)
    }

    if (!category.parentDom) {
      category.setParentDom(document.getElementById('contentList'))
    }

    category.show(
      id[1],
      {
      },
      function (err, data) {
        if (err) {
          return callback('error loading object "' + id[0] + '/' + id[1] +'": ' + err)
        }

        if (!map._popup || map._popup !== data.popup) {
          data.feature.openPopup()
        }

        if (options.showDetails) {
          showDetails(data, category)
        }

        callback(err)
      }
    )

    category.open()
  })
}

function showDetails (data, category) {
  var dom = document.getElementById('contentDetails')

  dom.innerHTML = ''

  var div = document.createElement('h1')
  div.className = 'title'
  div.innerHTML = data.data.title
  dom.appendChild(div)

  var div = document.createElement('div')
  div.className = 'description'
  div.innerHTML = data.data.description
  dom.appendChild(div)

  var div = document.createElement('div')
  div.className = 'body'
  div.innerHTML = data.data.body
  dom.appendChild(div)

  var div = document.createElement('div')
  div.className = 'body'
  dom.appendChild(div)
  category.renderTemplate(data, 'detailsBody', function (div, err, result) {
    div.innerHTML = result
  }.bind(this, div))

  var h = document.createElement('h3')
  h.innerHTML = 'Attributes'
  dom.appendChild(h)

  var div = document.createElement('dl')
  div.className = 'tags'
  for (var k in data.object.tags) {
    var dt = document.createElement('dt')
    dt.appendChild(document.createTextNode(k))
    div.appendChild(dt)
    var dd = document.createElement('dd')
    dd.appendChild(document.createTextNode(data.object.tags[k]))
    div.appendChild(dd)
  }
  dom.appendChild(div)

  var h = document.createElement('h3')
  h.innerHTML = 'OSM Meta'
  dom.appendChild(h)

  var div = document.createElement('dl')
  div.className = 'meta'
  var dt = document.createElement('dt')
  dt.appendChild(document.createTextNode('id'))
  div.appendChild(dt)
  var dd = document.createElement('dd')
  var a = document.createElement('a')
  a.appendChild(document.createTextNode(data.object.type + '/' + data.object.osm_id))
  a.href = 'https://openstreetmap.org/' + data.object.type + '/' + data.object.osm_id
  a.target = '_blank'

  dd.appendChild(a)
  div.appendChild(dd)
  for (var k in data.object.meta) {
    var dt = document.createElement('dt')
    dt.appendChild(document.createTextNode(k))
    div.appendChild(dt)
    var dd = document.createElement('dd')
    dd.appendChild(document.createTextNode(data.object.meta[k]))
    div.appendChild(dd)
  }
  dom.appendChild(div)
}

function hide () {
  document.getElementById('content').className = 'list'
}

window.showRootContent = hide
