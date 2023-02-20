var http = require('http');
var url = require('url');
var path = require('path');
var fs = require('fs');

var prefix = path.resolve(__filename === '[eval]' ? process.argv[1] : process.argv[2]);

var server = http.createServer(function (req, res) {
  var reqpath = path.resolve(prefix, url.parse(req.url).pathname.substring(1));
  if (reqpath.indexOf(prefix) === 0) {
    try {
      var buf = fs.readFileSync(reqpath);
      console.log(JSON.stringify({'path': reqpath, 'status': 200}));
      res.writeHead(200, {"Content-Type": "application/octet-stream"});
      res.write(buf);
      res.end();
      return;
    } catch (e) {
      // Ignore
    }
  }
  console.log(JSON.stringify({'path': reqpath, 'status': 404}));
  res.writeHead(404, {"Content-Type": "text/plain"});
  res.write('Not found');
  res.end();
});
server.listen(0, '127.0.0.1');
server.on('listening', function () {
  var address = server.address();
  // noinspection HttpUrlsUsage
  console.log(JSON.stringify({
    host: 'http://' + address.address + ':' + address.port,
    prefix: prefix
  }));
});
