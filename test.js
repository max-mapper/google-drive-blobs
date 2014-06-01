var fs = require('fs')
var path = require('path')
var test = require('tape')
var concat = require('concat-stream')
var gdb = require('./')

test('constructor does not throw', function(t) {
  var blobs = gdb()
  t.ok(blobs, 'constructed')
  t.end()
})

test('uploads a blob', function(t) {
  var blobs = gdb({
    token: process.argv[2] || JSON.parse(fs.readFileSync(path.join(process.env.HOME, '.config', 'googleauth.json'))).access_token
  })
  
  var ws = blobs.createWriteStream('index.js')
  
  ws.on('error', function(e) {
    t.false(e, 'should not error')
    t.end()
  })
  
  ws.on('end', function() {
    console.log('on end', ws.response)
    t.ok(true, 'got here')
    t.end()
  })
  
  fs.createReadStream('./test.js').pipe(ws)
})
