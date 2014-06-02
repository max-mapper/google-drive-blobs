var url = require('url')
var request = require('request')
var concat = require('concat-stream')
var mime = require('mime-types')
var through = require('through2')
var formEncoder = require('form-urlencoded')
var debug = require('debug')('google-drive-blobs')

// google APIs are weird
var baseURL = 'https://www.googleapis.com/drive/v2/'
var uploadBaseURL = 'https://www.googleapis.com/upload/drive/v2/'

function Blobs(options) {
  if (!(this instanceof Blobs)) return new Blobs(options)
  this.options = options
}

module.exports = Blobs

Blobs.prototype.createWriteStream = function(options, cb) {
  var self = this
  
  if (!options) options = {}
  
  var filename = options.filename
  var mimeType
  if (filename) {
    mimeType = mime.lookup(filename)
  }
  var parentID = options.parent

  var metaOpts = {
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
  
  // always start by refreshing the token to make sure it's active
  self.refreshToken(function(err, resp, body) {
    if (err) {
      return cb(err)
    }
    
    self.request(metaOpts, function(err, resp, body) {
      if (err || resp.statusCode > 299) return cb(err || resp.headers)
      var parsed = url.parse(resp.headers.location, true)
      var session = parsed.query.upload_id
      upload(session)
    })
  })
  
  var proxy = through()
  
  return proxy
  
  function upload(session) {
    var opts = {
      query: '?uploadType=resumable&upload_id=' + session
    }
    
    var put = self.request(opts)
    
    put.on('response', function(resp) {
      resp.pipe(handleUploadResponse())
    })
    
    put.on('error', function(err) {
      cb(err)
    })
    
    proxy.pipe(put)
    
    function handleUploadResponse() {
      return concat(function(body) {
        var response = JSON.parse(body)
        self.addProperty(response.id, 'hash', response.md5Checksum, function(err, resp, props) {
          if (err) return cb(err)
          response.hash = md5Checksum
          response.size = response.fileSize
          cb(null, response)
        })
      })
    }
  }
}

Blobs.prototype.addProperty = function(id, key, val, cb) {
  var hashProp = {
    "kind": "drive#property",
    "key": key,
    "value": val
  }
  
  var reqOpts = {
    url: baseURL + 'files/' + id + '/properties',
    json: hashProp
  }
  
  return this.request(reqOpts, cb)
}

Blobs.prototype.createReadStream = function(hash) {
  var self = this
  var proxy = through()
  
  self.get(hash, function(err, file) {
    if (err) return proxy.emit('error', err)
    self.request({
      url: file.downloadUrl,
      method: 'GET',
    }).pipe(proxy)
  })
  
  return proxy
}

Blobs.prototype.mkdir = function(filename, opts, cb) {
  var self = this
  var reqOpts = {
    json: {
      title: filename,
      mimeType: "application/vnd.google-apps.folder"
    },
    contentType: 'application/json',
    base: opts.baseURL
  }
  
  var put = self.request(reqOpts, cb)
}

Blobs.prototype.request = function(opts, cb) {
  var self = this
  if (!opts) opts = {}
  var token = self.options.access_token
  if (!token) return cb(new Error('you must specify google token'))
  
  var reqOpts = {
    method: opts.method || 'POST',
    url: (opts.base || uploadBaseURL) + 'files' + (opts.query || ''),
    headers: {
     'Content-Type': opts.contentType || 'text/plain',
     'Authorization': "Bearer " + token
    },
    json: opts.json
  }
  
  if (opts.url) reqOpts.url = opts.url
  
  return request(reqOpts, function(err, resp, body) {
    // token may have expired, refresh + retry
    if (resp.statusCode > 299) return self.refreshToken(function(err) {
      if (err) return cb(err)
      request(reqOpts, cb)
    })
    if (cb) cb(err, resp, body)
  })
}

Blobs.prototype.get = function(hash, cb) {
  var self = this
  var query = "properties has { key='hash' and value='" + hash + "' and visibility='PRIVATE' } and trashed = false"
  var reqOpts = {
    contentType: 'application/json',
    query: '?' + formEncoder.encode({q: query}),
    method: 'GET',
    base: baseURL,
    json: true
  }
  
  return self.request(reqOpts, function(err, resp, results) {
    if (err || resp.statusCode > 299) return cb(results)
    cb(null, results.items[0])
  })
}

Blobs.prototype.remove = function(hash, cb) {
  var self = this
  
  self.get(hash, function(err, file) {
    if (err) return cb(err)
    var reqOpts = {
      method: 'DELETE',
      url: baseURL + 'files/' + file.id
    }
  
    self.request(reqOpts, function(err, resp, results) {
      if (err || resp.statusCode > 299) return cb(results)
      cb(null)
    })
  })
}

Blobs.prototype.refreshToken = function(cb) {
  var self = this
  var opts = {
    refresh_token: self.options.refresh_token,
    client_id: self.options.client_id,
    client_secret: self.options.client_secret,
    grant_type: 'refresh_token'
  }
  request.post('https://accounts.google.com/o/oauth2/token', {
    form: opts,
    json: true
  }, function (err, res, body) {
    if (err) return cb(err, res, body)
    if (res.statusCode > 299) return cb(new Error('refresh error'), res, body)
    self.options.access_token = body.access_token
    cb(null, res, body)
  })
}
