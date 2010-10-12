<div id="paper"></div>
<script src="/raphael"></script>
<script>
var w = 540;
var h = 200;
var margin = 10;
var paper = Raphael(document.getElementById("paper"), w, h);


function fetch_graph(session_id, test_id) {
   var req;
   if (window.XMLHttpRequest) {
      try {
        req = new XMLHttpRequest();
      } catch(e) {
        req = false;
      }
   } else if (window.ActiveXObject) {
      try {
        req = new ActiveXObject("Microsoft.XMLHTTP");
      } catch(e) {
        req = false;
      }
   }
   req.open("GET", "/test/" + session_id + "/" + test_id + "/state", true);
   req.send("");
   req.onreadystatechange = function () {
      if (req.readyState == 4) {
         // FIXME
         var test_state = eval("(" + req.responseText + ")");
         progress_graph(test_state);
      }; 
   };
};


function progress_graph(test_state) {

  var y = h / 2;
  var start = margin;
  var end = w - margin;
  
  paper.clear();

  function x_for(d) {
   return start + ( (d / test_state.duration) * (end - start) );
  }

  // tick marks
  for (s=1;s<=test_state.duration; s++) {
   paper.path("M" + x_for(s) + " " + (y - 10) + " " +
              "L" + x_for(s) + " " + y + ' z'
   ).attr({"stroke": "#CCC"});
  };

  // fresh line
  var fresh_x = x_for(test_state.fresh_for);
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
  paper.text(fresh_x, y - 20, test_state.fresh_for + "s");
  
/*  // paint bugs
  for (b in test_state.bugs) {
     var bug = test_state.bugs[b].time;
     var x = start + ( (bug / test_state.duration) * (end - start) );
     paper.circle(x, y-5, 2).attr({"fill": "#000", "stroke": "none"});
  }
*/  
  function paint_reqs(reqs, y_offset, size, attrs) {
     for (r in reqs) {
        var req = reqs[r].time;
        var x = start + ( (req / test_state.duration) * (end - start) );
        paper.circle(x, y+y_offset, size).attr(attrs);
     }
  }

  paint_reqs(test_state.bugs, -5, 2, {fill: "#000", "stroke": "none"});
  paint_reqs(test_state.html_reqs, 8, 5, {fill: "#844", "stroke": "none"});
  paint_reqs(test_state.img_reqs, 18, 4, {fill: "#884", "stroke": "none"});
  paint_reqs(test_state.script_reqs, 28, 4, {fill: "#484", "stroke": "none"});
  paint_reqs(test_state.css_reqs, 38, 4, {fill: "#448", "stroke": "none"});
  paint_reqs(test_state.iframe_reqs, 48, 4, {fill: "#848", "stroke": "none"});
}
  
</script>
