User-Agent Tests
================

This is a HTTP server that tests UAs for HTTP conformance and functionality.

Requirements
------------

node.js <http://nodejs.org/>

Usage
-----

> node test-browser.js listen-port [state-file]

where `listen-port` is the TCP port to listen to. If `state-file` is
specified, it will be loaded at startup (if it exists), and all test
state will be written to it upon exit (i.e., when an interrupt is sent
to the server).

Upon startup, point the browser you wish to test at that port, and follow
the instructions there.