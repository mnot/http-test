<tr>
   <td>{{client_id}}</td>
   {{#tests}}<td onclick="fetch_graph({{session_id}}, {{test_id}});">
      {{#results}}
   <span class="html">{{#html}}•{{/html}}{{^html}}x{{/html}}</span>
   <span class="img">{{#img}}•{{/img}}{{^img}}x{{/img}}</span>
   <span class="script">{{#script}}•{{/script}}{{^script}}x{{/script}}</span>
   <span class="css">{{#css}}•{{/css}}{{^css}}x{{/css}}</span>
   <span class="iframe">{{#iframe}}•{{/iframe}}{{^iframe}}x{{/iframe}}</span>
      {{/results}}
   </td>{{/tests}}
</tr>
