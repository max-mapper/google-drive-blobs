var fs = require('fs')
var path = require('path')
var crypto = require('crypto')
var test = require('tape')
var concat = require('concat-stream')
var abstractBlobTests = require('abstract-blob-store/tests')
var gdb = require('./')

// assumes you are using npm install googleauth -g
var tokens = JSON.parse(fs.readFileSync(path.join(process.env.HOME, '.config', 'googleauth.json')))
tokens.client_id = process.env['GOOGLEAUTH_CLIENT'] || process.env[3]
tokens.client_secret = process.env['GOOGLEAUTH_SECRET'] || process.env[4]

var testmd5 = crypto.createHash('md5').update(fs.readFileSync('./test.js')).digest('hex')

var common = {
  setup: function(t, cb) {
    var store = gdb(tokens)
    cb(null, store)
  },
  teardown: function(t, store, blob, cb) {
    if (blob) store.remove(blob, cb)
    else cb()
  }
}

abstractBlobTests(test, common)

test('constructor does not throw', function(t) {
  var blobs = gdb()
  t.ok(blobs, 'constructed')
  t.end()
})

test('uploads a blob', function(t) {
  var blobs = gdb(tokens)

  var ws = blobs.createWriteStream({filename: 'test.js'}, function(err, resp) {
    t.false(err, 'should not error')
    if (err) console.error(err)
    t.equal(resp.key, testmd5)
    t.end()
  })

  fs.createReadStream('./test.js').pipe(ws)
})

test('gets blob metadata by md5', function(t) {
  var blobs = gdb(tokens)

  blobs.get(testmd5, function(err, file) {
    t.false(err, 'no err')
    t.equal(file.title, 'test.js')
    t.end()
  })
})

test('gets a blob', function(t) {
  var blobs = gdb(tokens)

  var ws = blobs.createReadStream({key: testmd5})

  ws.on('error', function(e) {
    t.error(e)
    t.end()
  })

  ws.pipe(concat(function(contents) {
    t.equal(contents.toString(), fs.readFileSync('./test.js').toString(), 'file contents match')
    t.end()
  }))
})

test('deletes a blob', function(t) {
  var blobs = gdb(tokens)

  var ws = blobs.remove({key: testmd5}, function(err) {
    t.false(err, 'snould not err')
    blobs.get(testmd5, function(err, file) {
      t.false(err, 'should not err')
      t.false(file, 'should have no results')
      t.end()
    })
  })

})
