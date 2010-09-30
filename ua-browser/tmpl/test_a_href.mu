{{#s}}
<html>
<head>
   <title>Test {{test_num}} of {{num_tests}}: {{id}}</title>   
</head>
<body>
<h1>This is the A HREF test.</h1>

<p>request {{req_num}}.</p>

<p>
{{#testing}}
  <a href="page">click me about once a second...</a>
{{/testing}}
{{^testing}}
  All done.
{{/testing}}
</p>

<img src="bug" width="0" height="0">

<div id="results"></div>
<script src="/raphael"></script>
<script>
  var w = 540;
  var h = 200;
  var margin = 10;
  // end conf
  var y = h / 2;
  var start = margin;
  var end = w - margin;
  var duration = {{duration}};
  var fresh_x = start + ( ({{fresh_for}} / duration) * (end - start) )
  var bugs = [{{#bugs}}{{time}}, {{/bugs}}];
  var reqs = [{{#reqs}}{{time}}, {{/reqs}}];
  var paper = Raphael(document.getElementById("results"), w, h);
  paper.path("M" + start + " " + y + " L " + end + " " + y + " z")
       .attr({"stroke": "#AAA"});
  paper.path("M" + fresh_x + " " + (y - 10) + " " +
             "L" + fresh_x + " " + (y + 10) + ' z' 
  );
  paper.text(w/2, y-40, "client requests").attr({
     'font-size': 14,
     'fill': "#aaa"
  });
  paper.text(w/2, y+40, "server requests").attr({
     'font-size': 14,
     'fill': "#aaa"
  });
  paper.text(fresh_x, y - 20, "{{fresh_for}}s");
  for (b in bugs) {
     var bug = bugs[b];
     var x = start + ( (bug / duration) * (end - start) );
     paper.circle(x, y-2, 3).attr({"fill": "#448", "stroke": "none"});
  }
  for (r in reqs) {
     var req = reqs[r];
     var x = start + ( (req / duration) * (end - start) );
     if (r == 0) {
        var colour = "#484";
     } else {
        var colour = "#844";
     }
     paper.circle(x, y+3, 5).attr({"fill": colour, "stroke": "none"});
  }
</script>


{{^testing}}
{{#show_next_test}}
<p>Ready for the <a href="../{{test_num}}/page">next one</a>?
{{/show_next_test}}
{{/testing}}



</body>
</html>
{{/s}}