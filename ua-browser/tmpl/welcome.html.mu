<html>
<head>
   <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
   {{> css.html}}
</head>
<body>
   
<h1>Start a Test</h1>

<form action='' method='POST'>
   Short name: <input type="text" name="short_name" /><br />
   <input type="submit" value="start test" />
</form>


<table>
{{> result_hdr.html}}
{{#state}}
   {{> results.html}}
{{/state}}
</table>

{{> progress_graph.html}}

</body>
</html>