function minusTen(n) {
  return new Date(n.valueOf() - (10 * 1000)).toUTCString();
};

function plusTen(n) {
  return new Date(n.valueOf() + (10 * 1000)).toUTCString();
};

this.tests = [
  {
    'id': 'expires_past',
    'desc': 'Expires in the past', 
    'status': 200,
    'res_hdrs': {'Expires': minusTen},
    'fresh_for': 0
  },
  {
    'id': 'expires_future',
    'desc': 'Expires in the future', 
    'status': 200,
    'res_hdrs': {'Expires': plusTen},
    'fresh_for': 10
  },
  {
    'id': 'expires_invalid',
    'desc': 'Invalid Expires header',
    'status': 200,
    'res_hdrs': {'Expires': 'foo'},
    'fresh_for': 0
  },
  {
    'id': 'cc_ma',
    'desc': 'Cache-Control: max-age=10',
    'status': 200,
    'res_hdrs': {'Cache-Control': 'max-age=10'},
    'fresh_for': 10
  },
  {
    'id': 'age',
    'desc': 'Cache-Control: max-age=10 + Age: 5',
    'status': 200,
    'res_hdrs': {
      'Cache-Control': 'max-age=10',
      'Age': '5'
    },
    'fresh_for': 5
  },
  {
    'id': 'old_date',
    'desc': 'Cache-Control: max-age=5 + Old Date', 
    'status': 200,
    'res_hdrs': {
      'Cache-Control': 'max-age=5',
      'Date': minusTen
    },
    'fresh_for': 0
  },
  {
    'id': 'cc_nc',
    'desc': 'Cache-Control: no-cache',
    'status': 200,
    'res_hdrs': {'Cache-Control': 'no-cache'},
    'fresh_for': 0
  },
  {
    'id': 'cc_ns',
    'desc': 'Cache-Control: no-store',
    'status': 200,
    'res_hdrs': {'Cache-Control': 'no-store'},
    'fresh_for': 0
  },
  {
    'id': 'cc_precedence',
    'desc': 'Cache-Control: max-age precedence over Expires', 
    'status': 200,
    'res_hdrs': {
      'Cache-Control': 'max-age=0',
      'Expires': plusTen
    },
    'fresh_for': 0
  },
  {
    'id': 'vary_star',
    'desc': 'Vary: * caching', 
    'status': 200,
    'res_hdrs': {
      'Cache-Control': 'max-age=10',
      'Vary': '*'
    },
    'fresh_for': 0
  },
  {
    'id': 'unk_status',
    'desc': 'Unknown Status Code', 
    'status': ['250', 'Whatever'],
    'res_hdrs': {'Cache-Control': 'max-age=10'},
    'fresh_for': 0
  },
  /*
  {
    'id': '',
    'desc': '', 
    'status': 200,
    'res_hdrs': {},
    'fresh_for': 0
  },
  */
];

var asset_types = ['html', 'img', 'script', 'css', 'iframe'];
var tolerance = 2;

this.interpret = function(test) {
  results = {};
  for (i in asset_types) {
    var result;
    var reqs = test[asset_types[i] + "_reqs"];
    var second_req;
    try {
      second_req = reqs[1].time;
    } catch(err) {
      // we assume that if there isn't a second request, the test fails.
      results[asset_types[i]] = false;
      continue;
    }
    var bug_count = 0;
    var first_bug = test.bugs[0].time;
    for (b in test.bugs) {
      var bug = test.bugs[b].time;
      if (bug > (test.fresh_for + first_bug) && bug < second_req) { 
        bug_count++;
      }
    };
    var result = true;
    if (bug_count > 0) {
      result = false;
      console.log("*" + test.fresh_for + " " + second_req + " ");
      console.log(test.bugs);
    }
    results[asset_types[i]] = result;
  };
  return results;
};