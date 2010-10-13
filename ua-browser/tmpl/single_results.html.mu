<html>
<head>
   <title>Test Results</title> 
   <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
   {{> css.html}}
</head>
<body>
<h1>Test Results</h1>

<table>
{{> result_hdr.html}}
{{#session_state}}
  {{> results.html}}
{{/session_state}}
</table>

{{> progress_graph.html}}