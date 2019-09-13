var express = require('express');
var moment = require('moment');
var router = express.Router();
var AU = require('ansi_up');
var ansi_up = new AU.default;

router.get('/', function(req, res, next) {
  res.render('index', { title: 'Log Search' });
});

router.post('/search', function (req, res) {
  const ft = moment(req.body.from_time).utc();
  const searchIndex = 'logstash-' + ft.format('YYYY') + '.' + ft.format('MM') + '.' + ft.format('DD') + '*';
  const searchParams = {
    index: searchIndex,
    body: {
      size: 1000,
      sort: [
        {
          "@timestamp": {
            order: "desc",
            unmapped_type: "boolean"
          }
        }
      ],
      "query": {
        "bool": {
          "must": [
            {
              "query_string": {
                "query": "_exists_: level AND (level:\"ERROR\")",
                "analyze_wildcard": true
              }
            },
            {
              "match": {
                "kubernetes.namespace_name": {
                  "query": "c-" + req.body.customer,
                  "type": "phrase"
                }
              }
            },
            {
              "range": {
                "@timestamp": {
                  "gte": moment(req.body.from_time).format('x'),
                  "lte": moment(req.body.to_time).format('x'),
                  "format": "epoch_millis"
                }
              }
            }
          ],
          "must_not": [
            {
              "query_string": {
                "query": "*sentry*",
                "analyze_wildcard": true
              }
            },
          ]
        }
      }
    }
  }

  const { Client } = require('@elastic/elasticsearch')
  const client = new Client({ node: 'http://localhost:9200' })

  client.search(searchParams, (err, result) => {
    if (err) console.log(err)
    const errorHits = [];
    var regex = new RegExp('.*error.*', 'i');
    var sentryRegex = new RegExp('.*sentry.*', 'i');
    for (var h of result.body.hits.hits) {
      if (h && h._source && h._source.log.match(regex)) {
        errorHits.push({
          log: ansi_up.ansi_to_html(h._source.log)
        })
      }
    }
    res.render('results', {
      hits:  errorHits,
      title: 'Results for ' + req.body.customer
    });
  })

})

module.exports = router;
