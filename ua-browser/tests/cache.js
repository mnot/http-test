this.tests = [
    {
        'id': 'cc_ma',
        'desc': 'Cache-Control: max-age=10',
        'res_hdrs': {'Cache-Control': 'max-age=10'},
        'fresh_for': 10
    },
    {
        'id': 'cc_nc',
        'desc': 'Cache-Control: no-cache',
        'res_hdrs': {'Cache-Control': 'no-cache'},
        'fresh_for': 0
    }

];