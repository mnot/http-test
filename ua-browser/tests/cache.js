function pastExpires(n) {
  return new Date(n.valueOf() - (10 * 1000)).toUTCString();
};

function futureExpires(n) {
  return new Date(n.valueOf() + (10 * 1000)).toUTCString();
};

this.tests = [
  {
    'id': 'expires_past',
    'desc': 'Expires in the past', 
    'res_hdrs': {'Expires': pastExpires},
    'fresh_for': 0
  },
  {
    'id': 'expires_future',
    'desc': 'Expires in the future', 
    'res_hdrs': {'Expires': futureExpires},
    'fresh_for': 10
  },
  {
    'id': 'cc_ma',
    'desc': 'Cache-Control: max-age=10',
    'res_hdrs': {'Cache-Control': 'max-age=10'},
    'fresh_for': 10
  },
  {
    'id': 'age',
    'desc': 'Cache-Control: max-age=10',
    'res_hdrs': {
      'Cache-Control': 'max-age=10',
      'Age': '5'
    },
    'fresh_for': 5
  },
  {
    'id': 'cc_nc',
    'desc': 'Cache-Control: no-cache',
    'res_hdrs': {'Cache-Control': 'no-cache'},
    'fresh_for': 0
  },
];

var asset_types = ['html', 'img', 'script', 'css', 'iframe'];
var tolerance = 2;

this.interpret = function(test) {
  results = {};
  for (i in asset_types) {
    var result;
    var reqs = test[asset_types[i] + "_reqs"];
    var second_req = reqs[1];
    var last_fresh_bug;
    for (b in test.bugs) {
      var bug = test.bugs[b];
      if (bug < second_req) {
        last_fresh_bug = bug;
      }
    }
    var fresh_offset = last_fresh_bug - test.fresh_for;
    if (fresh_offset > 0) {
      result = false;
    } else if (fresh_offset < -tolerance) {
      result = null;
    } else {
      result = true;
    }
    results[asset_types[i]] = result;
  };
  return results;
};