{{#s}}
<html>
<head>
   <title>Test {{test_num}} of {{num_tests}}: {{desc}}</title> 
   <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
   {{#testing}}  
   <link rel="STYLESHEET" type="text/css" href="css">
   {{/testing}}
   {{> css.html}}
</head>
<body>
<h1>Test {{test_num}} of {{num_tests}}: {{desc}}</h1>

<p>
{{#testing}}
  <a href="page">click me about once a second...</a>
{{/testing}}
{{^testing}}
   All done.
   {{^tests_complete}}
    <a href="../{{test_num}}/page">Ready for the next one</a>?
   {{/tests_complete}}
   {{#tests_complete}}
    <a href="../">Show results</a>.
   {{/tests_complete}}
{{/testing}}
</p>

{{> progress_graph.html}}

{{#testing}}
<img src="img" width="1" height="1" border="1">
<script src="script" type="text/javascript"></script>
<iframe src="iframe" width="1" height="1"></iframe>
<img src="bug" width="0" height="0">
{{/testing}}

</body>
</html>
{{/s}}