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

{{> progress_graph.html}}

{{^testing}}
{{#show_next_test}}
<p>Ready for the <a href="../{{test_num}}/page">next one</a>?
{{/show_next_test}}

{{^show_next_test}}

<table>
  {{> result_hdr.html}}
  {{> results.html}}
</table>  
{{/show_next_test}}

{{/testing}}



</body>
</html>
{{/s}}