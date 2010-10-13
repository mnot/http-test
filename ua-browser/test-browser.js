#!/usr/bin/env node

var fs = require("fs");
var http = require('datehttp'); /* FIXME: just for now... */
var path = require("path");
var qs = require("querystring");
var sys = require('sys');
var url = require("url");

var argv = require('./lib/optimist').argv;
var Mu = require('./lib/Mu');

// how long to continue testing for.
var tolerance = 2;

// port to listen to 
var port = parseInt(argv._[0]);
if (! port || port == NaN) {
  console.log("Usage: test-browser.js listen-port [state-file]");
  process.exit(1);
}

state_file = argv._[1];

// load templates
Mu.templateRoot = './tmpl';

// load static assets
var static = {
  'raphael': fs.readFileSync('lib/raphael-min.js'),
  '1x1': fs.readFileSync('lib/1x1.png')
}

// load asset objects
var a = require('./assets');
var assets = a.assets;

// the list of test plans 
var t = require('./tests/cache');
var test_plans = t.tests;
var interpret = t.interpret;
console.log("loading " + test_plans.length + " test plans...");

// where ALL test state is stored.
var state;
if (state_file) {
  try {
    var state_str = fs.readFileSync(state_file);
    state = JSON.parse(state_str);
    console.log("loaded state file.");
  } catch(e) {
    if (e.errno == 2) {
      state = {};
    } else {
    console.log("Error reading state file: " + e.message);
    process.exit(1);
    }
  }
} else {
  state = {};
}

function save_state() {
    if (state_file) {
      console.log('saving state to file...');
      var state_str = JSON.stringify(state);
      fs.writeFileSync(state_file, state_str, 'utf-8');
      console.log('done.');
      process.exit(0);
    }
}

if (state_file) {
  process.on('SIGINT', save_state);
}  



http.createServer(function (request, response) {
  request.input_buffer = "";
  request.on('data', function(chunk) {
    request.input_buffer += chunk;
  });
  request.on('end', function() {
    req_done(request, response);
  });
}).listen(port);  
  
  
function req_done(request, response) {
  var path = url.parse(request.url).pathname;
  var path_segs = path.split("/");
  path_segs.shift();
  var root = path_segs.shift();
  switch (root) {
    case '':
      intro_page(request, response);
      break;
    case 'test':
      var cid = path_segs.shift();
      var session_state = state[cid];
      if (! session_state) {
        not_found(request, response);
      } else {
        test_req(request, response, path_segs, session_state);
      }
      break;
    case 'raphael':
      response.writeHead(200, {
        'Content-Type': "application/javascript",
        'Cache-Control': "max-age=7200"
      })
      response.end(static['raphael']);
      break;
    default:
      not_found(request, response);
      break;
  }
};

/* Show the welcome page. */
function intro_page(request, response) {
    switch (request.method) {
        case 'GET':
            response.writeHead(200, {'Content-Type': 'text/html'});
            render('welcome.html', {
              'state': hash_list(state),
              'test_plans': test_plans
            }, response);
            break;
        case 'POST':
            var id = gen_id(request);
            see_other(response, '/test/' + id + '/');
            break;
        default:
            method_not_allowed(response);
            break;
    }
}

// serve a test request
function test_req(request, response, path_segs, session_state) {
  // TODO: don't let a finished test be re-run.
  var tid = path_segs.shift();
  if (tid == "") {
    if (! session_state.tests[0]) {
      // Start testing.
      return see_other(response, '/test/' + session_state.id + '/0/page');      
    } else {
      // show results
      response.writeHead(200, {'Content-Type': 'text/html'});
      return render('single_results.html', {
        'session_state': session_state,
        'test_plans': test_plans
        }, response);
    }
  }
  tid = parseInt(tid);
  if (tid == NaN || tid > test_plans.length - 1) {
    // invalid TID
    return not_found(request, response);
  }
  if (! session_state.tests[tid]) {
    // newly started test
    session_state.tests[tid] = {
      'session_id': session_state.id,
      'test_id': tid,
      'start': new Date(),
      'bugs': [],
      'html_reqs': [],
      'img_reqs': [],
      'script_reqs': [],
      'css_reqs': [],
      'iframe_reqs': [],
      'testing': true,
      'duration': test_plans[tid].fresh_for + tolerance, 
      'results': undefined
    };
    // update the test state with the test plan
    for (attr in test_plans[tid]) {
      session_state.tests[tid][attr] = test_plans[tid][attr];
    }
    // set a timeout for the test period.
    session_state.tests[tid].timeout = setTimeout(function () {
      session_state.tests[tid].testing = false;
    }, (session_state.tests[tid].duration) * 1000);
  }
  var test_state = session_state.tests[tid];    
  switch (path_segs.shift()) {
    case "bug":
      bug(request, response, test_state);
      break;
    case "page":
      if (test_state.testing
        && ("cache-control" in request.headers
            || "pragma" in request.headers)
        && tid == 0
        && ! /Chrome/.test(request.headers['user-agent'])
        && ! /MSIE/.test(request.headers['user-agent'])
      ) {
        // evidence of reload. We can't catch this in Chrome and IE
        // because it sends Cache-Control: max-age on POST requests
        // and subsequent redirects. *sigh*
        clearTimeout(test_state.timeout);
        delete session_state[tid];
        response.writeHead(400, {'Content-Type': 'text/html'});
        return render('noreload.html', {}, response)
      }

      test_state.html_reqs.push({
        'time': ( new Date() - test_state.start ) / 1000
      });
      
      if (! test_state.testing) {
        test_state.results = interpret(test_state);
      }

      var res_hdrs = {
        'Content-Type': "text/html",
        'Cache-Control': "private"
      }
      if (test_state.html_reqs.length == 1) {
        response.writeHead(
          test_state.status, 
          prep_hdrs(res_hdrs, test_state.res_hdrs)
        );
      } else {
        response.writeHead(200, res_hdrs);
      };
      render('test_a_href', {
        's': test_state,
        'test_num': tid + 1,
        'num_tests': test_plans.length,
        'tests_complete': tid + 1 >= test_plans.length,
        'req_num': test_state.html_reqs.length,
        'test_plans': test_plans,
        'test_session': session_state,
        'test_state_json': JSON.stringify(test_state),
      }, response);
      break;
    case 'img':
      test_asset(request, response, test_state, assets.img);
      break;
    case 'script':
      test_asset(request, response, test_state, assets.script);
      break;
    case 'css':
      test_asset(request, response, test_state, assets.css);
      break;
    case 'iframe':
      test_asset(request, response, test_state, assets.iframe);
      break;
    case 'state':
      response.writeHead(200, {
        'Cache-Control': 'max-age=1',
        'Content-Type': 'application/json'
      });
      response.end(JSON.stringify(test_state));
      break;
    default:
      not_found(request, response);
      break;
  }
}

// serve a test-related asset (not the main HTML)
function test_asset(request, response, test_state, asset) {
  if ( ! test_state[asset.name + '_reqs']) {
    test_state[asset.name + '_reqs'] = [];
  }
  test_state[asset.name + '_reqs'].push({
    'time': ( new Date() - test_state.start ) / 1000
  });
  var res_hdrs = {
    'Content-Type': asset.type,
    'Cache-Control': "private"
  };
  response.writeHead(
    test_state.status, 
    prep_hdrs(res_hdrs, test_state.res_hdrs)
  );
  response.end(asset.content);
}

// prepare test headers
function prep_hdrs(default_hdrs, test_hdrs) {
  var res_hdrs = {};
  var now = new Date();
  for (attr in default_hdrs) {
    res_hdrs[attr] = default_hdrs[attr];
  };  
  for (attr in test_hdrs) {
    if (typeof test_hdrs[attr] == 'function') {
      res_hdrs[attr] = test_hdrs[attr](now);
    } else {
      res_hdrs[attr] = test_hdrs[attr];
    };
  };
  return res_hdrs;
};

// serve the monitoring bug and record it to test_state
function bug(request, response, test_state) {
  response.writeHead(200, {
    'Content-Type': 'image/png',
    'Cache-Control': 'private, no-cache, no-store',
    'Vary': '*'
  });
  response.end(static['1x1']);
  var delay = ( new Date() - test_state.start ) / 1000;
  test_state.bugs.push({'time': delay});
}

// return a 303 See Other
function see_other(response, location) {
  response.writeHead(303, {
    'Content-Type': 'text/plain',
    'Location': location,
  });            
  response.end("Redirecting...");
}

// return a 404 Not Found
function not_found(request, response) {
  response.writeHead(404, {'Content-Type': 'text/html'});
  console.log("* Not found: " + request.url)
  render('notfound.html', {}, response)
}

// return a 405 Method Not Allowed
function method_not_allowed(response) {
  response.writeHead(405, {'Content-Type': 'text/html'});
  render('methodnotallowed.html', {}, response)
}

// render the given template with ctx to the response
function render(template, ctx, response) {
  Mu.render(template, ctx, {}, function (err, output) {
    if (err) {
      throw err;
    }
    buffer = "";
    output.addListener('data', function (d) { buffer += d; })
          .addListener('end', function () { response.end(buffer) });
  });    
}

function hash_list(s) {
  var l = [];
  for (k in s) {
    l.push(s[k]);
  }
  return l;
}

/* 
Generate a unique identifier for this session, so that we can 
test a single browser instance. 
*/
function gen_id(request) {
  var id = Math.random();
  var short_name = qs.parse(request.input_buffer)['short_name'];
  var session_state = {
    'ua': request.headers['user-agent'],
    'id': id,
    'client_id': short_name || id,
    'tests': []
  };
  state[id] = session_state;
  return id;
  // TODO: persistence, gc
}

sys.puts('Server running on port ' + port + '.');
