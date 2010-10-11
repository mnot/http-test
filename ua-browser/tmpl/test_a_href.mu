{{#s}}
<html>
<head>
   <title>Test {{test_num}} of {{num_tests}}: {{id}}</title> 
   {{#testing}}  
   <link rel="STYLESHEET" type="text/css" href="css">
   {{/testing}}
</head>
<body>
<h1>{{desc}}</h1>

<p>request {{req_num}}.</p>

<p>
{{#testing}}
  <a href="page">click me about once a second...</a>
{{/testing}}
{{^testing}}
  All done.
  {{#show_next_test}}
    <a href="../{{test_num}}/page">Ready for the next one</a>?
  {{/show_next_test}}
{{/testing}}
</p>

{{> progress_graph.html}}

{{^show_next_test}}
<table>
  {{> result_hdr.html}}
  {{> results.html}}
</table>  
{{/show_next_test}}

{{#testing}}
<img src="img" width="1" height="1" border="1">
<script src="script" type="text/javascript"></script>
<iframe src="iframe" width="1" height="1"></iframe>
<img src="bug" width="0" height="0">
{{/testing}}

</body>
</html>
{{/s}}