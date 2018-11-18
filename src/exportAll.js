const tabs = require('modulekit-tabs')
const async = require('async')
const FileSaver = require('file-saver')

const chunkSplit = require('./chunkSplit')

const types = {
  GeoJSON: require('./ExportGeoJSON'),
  OSMXML: require('./ExportOSMXML')
}

let tab
let formExport

function prepareDownload (callback) {
  let conf = formExport.get_data()

  global.baseCategory.allMapFeatures((err, data) => {
    if (err) {
      return callback(err)
    }

    createDownload(conf, data, callback)
  })
}

function createDownload (conf, data, callback) {
    let type = types[conf.type]
    let exportFun = new type(conf)

    let chunks = chunkSplit(data, 1000)
    let parentNode

    async.mapLimit(
      chunks,
      1,
      (chunk, done) => {
        async.map(chunk,
          (ob, done) => exportFun.each(ob, done),
          (err, result) => {
            global.setTimeout(() => done(err, result), 0)
          }
        )
      },
      (err, data) => {
        if (err) {
          return callback(err)
        }

        data = data.reduce((all, chunk) => all.concat(chunk))

        let result = exportFun.finish(data)

        var blob = new Blob([ result.content ], { type: result.fileType + ';charset=utf-8' })
        FileSaver.saveAs(blob, 'openstreetbrowser.' + result.extension)

        callback()
      }
    )
}

function formDef () {
  let values = {}
  Object.keys(types).forEach(type =>
    values[type] = lang('export:' + type)
  )

  return {
    type: {
      name: 'Type',
      type: 'radio',
      values,
      default: Object.keys(types)[0]
    }
  }
}

register_hook('init', function () {
  tab = new tabs.Tab({
    id: 'export'
  })
  global.tabs.add(tab)

  tab.header.innerHTML = '<i class="fa fa-download" aria-hidden="true"></i>'
  tab.content.innerHTML = lang('export-all')

  formExport = new form('export', formDef())

  let domForm = document.createElement('form')
  tab.content.appendChild(domForm)
  formExport.show(domForm)

  let submit = document.createElement('input')
  submit.type = 'submit'
  submit.value = lang('export-prepare')
  submit.onclick = () => {
    let progressIndicator = document.createElement('div')
    progressIndicator.innerHTML = '<i class="fa fa-spinner fa-pulse fa-fw"></i><span class="sr-only">' + lang('loading') + '</span>'
    tab.content.appendChild(progressIndicator)
    submit.style.display = 'none'

    prepareDownload((err) => {
      if (err) {
        alert(err)
      }

      submit.style.display = 'block'
      tab.content.removeChild(progressIndicator)
      tab.unselect()
    })
  }
  tab.content.appendChild(submit)

  tab.on('select', () => {
    formExport.resize()
  })
})

module.exports = (data, div) => {
  let formExport = new form('exportOne', formDef())

  let domForm = document.createElement('form')
  div.appendChild(domForm)
  formExport.show(domForm)

  let submit = document.createElement('input')
  submit.type = 'submit'
  submit.value = lang('export-prepare')
  submit.onclick = () => {
    let progressIndicator = document.createElement('div')
    progressIndicator.innerHTML = '<i class="fa fa-spinner fa-pulse fa-fw"></i><span class="sr-only">' + lang('loading') + '</span>'
    div.appendChild(progressIndicator)
    submit.style.display = 'none'

    let conf = formExport.get_data()
    createDownload(conf, [ data ], (err) => {
      if (err) {
        alert(err)
      }

      submit.style.display = 'block'
      div.removeChild(progressIndicator)
    })
  }
  div.appendChild(submit)
}