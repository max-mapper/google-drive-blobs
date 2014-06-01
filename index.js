var url = require('url')
var request = require('request')
var combiner = require('stream-combiner')
var mime = require('mime-types')
var through = require('through2')
var debug = require('debug')('google-drive-blobs')

// google APIs are weird
var baseURL = 'https://www.googleapis.com/drive/v2/'
var uploadBaseURL = 'https://www.googleapis.com/upload/drive/v2/'

function Blobs(options) {
  if (!(this instanceof Blobs)) return new Blobs(options)
  this.options = options
}

module.exports = Blobs
module.exports.mkdir = mkdir
module.exports.request = driveRequest

Blobs.prototype.createWriteStream = function(filename, options) {
  var self = this
  
  if (!options) options = {}
  
  var token = options.token || this.options.token
  var parentID = options.parent
  var mimeType = mime.lookup(filename)

  var metaOpts = {
    token: token,
    query: '?uploadType=resumable',
    json: {
      title: filename,
      mimeType: mimeType
    },
    contentType: 'application/json'
  }
  
  if (parentID) metaOpts.json.parents = [{
    "kind": "drive#fileLink",
    "id": parentID
  }]
  
  driveRequest(metaOpts, function(err, resp, body) {
    if (err || resp.statusCode > 299) return proxy.emit('error', err || resp.headers)
    var parsed = url.parse(resp.headers.location, true)
    var session = parsed.query.upload_id
    upload(session)
  })
  
  var proxy = through({end: false})
  return proxy
  
  function upload(session) {
    var opts = {
      token: token,
      query: '?uploadType=resumable&upload_id=' + session
    }
    
    var put = driveRequest(opts, function(err, resp, body) {
      if (err || resp.statusCode > 299) return proxy.emit('error', err || resp.headers)
      proxy.response = JSON.parse(body)
      console.log('calling end()')
      proxy.end()
    })
    
    console.log('piping')
    proxy.pipe(put)
  }
}

Blobs.prototype.createReadStream = function(hash) {
  // todo
}

function mkdir(filename, opts, cb) {
  var reqOpts = {
    token: opts.token,
    json: {
      title: filename,
      mimeType: "application/vnd.google-apps.folder"
    },
    contentType: 'application/json',
    base: opts.baseURL
  }
  
  var put = driveRequest(reqOpts, cb)
}

function driveRequest(opts, cb) {
  if (!opts) opts = {}
  if (!opts.token) return cb(new Error('you must specify google token'))
  
  var reqOpts = {
    method: opts.method || 'POST',
    url: (opts.base || uploadBaseURL) + 'files' + (opts.query || ''),
    headers: {
     'Content-Type': opts.contentType || 'text/plain',
     'Authorization': "Bearer " + opts.token
    },
    json: opts.json
  }
  return request(reqOpts, cb)
}
