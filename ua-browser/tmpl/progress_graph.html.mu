<div id="paper"></div>
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
  var imgs = [{{#img_reqs}}{{time}}, {{/img_reqs}}];
  var scripts = [{{#script_reqs}}{{time}}, {{/script_reqs}}];
  var csses = [{{#css_reqs}}{{time}}, {{/css_reqs}}];
  var iframes = [{{#iframe_reqs}}{{time}}, {{/iframe_reqs}}];
  var paper = Raphael(document.getElementById("paper"), w, h);
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
  
  // paint bugs
  for (b in bugs) {
     var bug = bugs[b];
     var x = start + ( (bug / duration) * (end - start) );
     paper.circle(x, y-2, 3).attr({"fill": "#448", "stroke": "none"});
  }
  
  function paint_reqs(reqs, y_offset, shape, size, attrs) {
     for (r in reqs) {
        var req = reqs[r];
        var x = start + ( (req / duration) * (end - start) );
        paper[shape](x, y+y_offset, size).attr(attrs);
     }
  }

  var first_req = reqs.shift();
  paint_reqs([first_req], 3, 'circle', 5, {"fill": "#484", "stroke": "none"});
  paint_reqs(reqs, 3, 'circle', 5, {"fill": "#844", "stroke": "none"});
  paint_reqs(imgs, 9, 'circle', 4, {"fill": "#884", "stroke": "none"});
  paint_reqs(scripts, 14, 'circle', 4, {"fill": "#884", "stroke": "none"});
  paint_reqs(csses, 19, 'circle', 4, {"fill": "#884", "stroke": "none"});
  paint_reqs(iframes, 24, 'circle', 4, {"fill": "#884", "stroke": "none"});
  
</script>
