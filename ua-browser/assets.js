var fs = require("fs");

this.assets = {
  'img': {
    'name': 'img',
    'type': 'image/png',
    'content': fs.readFileSync('lib/1x1.png')
  },
  'script': {
    'name': 'script',
    'type': 'text/javascript',
    'content': 'var t = 1;'
  },
  'css': {
    'name': 'css',
    'type': 'text/css',
    'content': '.foo { color: blue; }'
  },
  'iframe': {
    'name': 'iframe',
    'type': 'text/html',
    'content': '<html><head></head><body><p>iframe</p></body></html>'
  }
}