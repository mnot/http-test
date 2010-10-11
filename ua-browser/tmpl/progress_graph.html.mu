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
  var bugs = [{{#bugs}}{{time}}, {{/bugs}}];
  var reqs = [{{#html_reqs}}{{time}}, {{/html_reqs}}];
  var imgs = [{{#img_reqs}}{{time}}, {{/img_reqs}}];
  var scripts = [{{#script_reqs}}{{time}}, {{/script_reqs}}];
  var csses = [{{#css_reqs}}{{time}}, {{/css_reqs}}];
  var iframes = [{{#iframe_reqs}}{{time}}, {{/iframe_reqs}}];
  var paper = Raphael(document.getElementById("paper"), w, h);

  function x_for(d) {
   return start + ( (d / duration) * (end - start) );
  }

  // tick marks
  for (s=1;s<=duration; s++) {
   paper.path("M" + x_for(s) + " " + (y - 10) + " " +
              "L" + x_for(s) + " " + y + ' z'
   ).attr({"stroke": "#CCC"});
  };

  // fresh line
  var fresh_x = x_for({{fresh_for}});
  paper.path("M" + start + " " + y + " L " + end + " " + y + " z")
       .attr({"stroke": "#AAA"});
  paper.path("M" + fresh_x + " " + (y - 10) + " " +
             "L" + fresh_x + " " + (y + 60) + ' z' 
  );

  paper.text(w/2, y-70, "client requests").attr({
     'font-size': 14,
     'fill': "#aaa"
  });
  paper.text(w/2, y+70, "server requests").attr({
     'font-size': 14,
     'fill': "#aaa"
  });
  paper.text(fresh_x, y - 20, "{{fresh_for}}s");
  
  // paint bugs
  for (b in bugs) {
     var bug = bugs[b];
     var x = start + ( (bug / duration) * (end - start) );
     paper.circle(x, y-5, 2).attr({"fill": "#000", "stroke": "none"});
  }
  
  function paint_reqs(reqs, y_offset, size, attrs) {
     for (r in reqs) {
        var req = reqs[r];
        var x = start + ( (req / duration) * (end - start) );
        paper.circle(x, y+y_offset, size).attr(attrs);
     }
  }

  paint_reqs(reqs, 8, 5, {"fill": "#844", "stroke": "none"});
  paint_reqs(imgs, 18, 4, {"fill": "#884", "stroke": "none"});
  paint_reqs(scripts, 28, 4, {"fill": "#484", "stroke": "none"});
  paint_reqs(csses, 38, 4, {"fill": "#448", "stroke": "none"});
  paint_reqs(iframes, 48, 4, {"fill": "#848", "stroke": "none"});
  
</script>
