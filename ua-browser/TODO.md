TODO
====

TODO file for UA tests; currently caching-specific.

Request Types
-------------

The following request types need to be covered still:

- @import to css
- XHR (to app/octet?)

Setup
-----

A setup phase would allow verification that caching is turned on, and 
would allow checking to see if automated navigation (e.g., refresh) affects
cache operation; if it doesn't, we can avoid all of the click-click-click
that's necessary now.

Conformance Tests
-----------------

Tests that affect HTTP conformance; failing indicates non-conformance.

### fresh_for -style tests

- Doesn't cache FOO method responses
- Doesn't cache nominated status codes without explicit freshness
- Doesn't cache PUT requests/responses
- Doesn't cache DELETE requests/responses
- Doesn't cache Vary: *

### Invalidation checks

- Doesn't cache Vary: cookie with different cookie
- Invalidates request-URI on POST / PUT / DELETE
- Invalidates content-location on POST / PUT / DELETE
- Invalidates location on POST / PUT / DELETE
- Invalidates request-URI on FOO

### Misc

- Doesn't cache on request Cache-Control: no-cache
- Doesn't cache on request Cache-Control: no-store
- Doesn't cache on request Cache-Control: max-age=n w/ age > n
- Doesn't cache on request Cache-Control: max-stale...
- 504s on Cache-Control: only-if-cached when not in cache
- header nomination and private, no-cache
- validation
- clockless origin server
- detailed age calculation
- stale responses (+ must-revalidate)
- malformed age, cache-control, date

Functionality Tests
--------------------

Tests that demonstrate that caching is functional. Failing them doesn't 
affect conformance, but it does degrade the usefulness of the cache.

- Caches Expires: [past] + Cache-Control: max-age=[future]
- Caches URI with query string + explicit freshness
- Caches nominated status codes without explicit freshness
- Caches authenticated responses
- Caches POST responses for future GETs
- Caches PATCH responses
- Caches Vary: cookie with same cookie
- Caches on request Cache-Control: max-age=n w/ age <= n
- Caches on request Cache-Control: max-stale...
- Caches partial response
- Combines partial response from cache
- Caches Expires: [future]
- Caches Cache-Control: max=age=n
- Caches Cache-Control: max-age=n + wait (n-m)
- Caches Cache-Control: max-age=n + Age: (n-m)
- Caches Vary: Accept-Encoding
- Caches Vary: User-Agent
- Caches Vary: Host
