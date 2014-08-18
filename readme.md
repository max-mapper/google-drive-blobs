# google-drive-blobs

a simple content-addressable blob store API on top of google drive

compatible with the [abstract-blob-store](https://github.com/maxogden/abstract-blob-store) API and passes its test suite

[![NPM](https://nodei.co/npm/google-drive-blobs.png)](https://nodei.co/npm/google-drive-blobs/)

## API

### var blobs = require('google-drive-blobs')(options)

`options` must be an object that has the following properties:

`refresh_token`: the refresh token from your current google auth session (this module doesn't handle authenticating, only refreshing)
`client_id`: your google app client id
`client_secret`: your google app client secret

### blobs.createWriteStream(options, cb)

returns a writable stream that you can pipe data to. 

`options` should be an object that has options `filename` (will be the filename in your drive) and `parent` (google drive parent node) properties

`cb` will be called with `(err, response)` where `response` is the response metadata

### blobs.createReadStream(opts)

opts should be `{key: md5}`

returns a readable stream of data for the first file in your drive whose md5 checksum matches the `md5` argument

### blobs.get(md5, cb)

gets google drive metadata for the first file in your drive whose md5 checksum matches the `md5` argument

### blobs.remove(opts, cb)

opts should be `{key: md5}`
 
deletes file by md5

### blobs.addProperty(fileId, key, val, cb)

adds a key/value pair to a file by drive `fileId`, calls `cb` with `(err)`

## google drive API gripes

you can only search by certain properties, and `md5Checksum` isnt one of them. 

so i either have to hash the file ahead of time (not stream upload friendly) 
or i have to do a second request that copies the `md5Checksum` that i get back from the upload to the 'custom properties' field, which IS searchable

so basically to upload a file i have to do 4 requests, one to check if a file w/ that hash exists already, one to create the upload metadata, one to upload the file contents, and one to move md5Checksum to the custom properties field

to stream a file by hash i have to do two queries, one to find the file by the custom hash property and a second to stream the `downloadUrl` from the result of the first request
