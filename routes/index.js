var express = require('express');
var moment = require('moment');
var router = express.Router();

router.get('/', function(req, res, next) {
  res.render('index', {
    title: 'Log Search',
    hits: [],
    startTime: moment(Date.now()).subtract(15, 'minutes').format('YYYY-MM-DDTHH:mm'),
    endTime: moment().format('YYYY-MM-DDTHH:mm')
  });
});

router.post('/', function (req, res) {
  const ft = moment(req.body.from_time).utc();
  const searchIndex = 'logstash-' + ft.format('YYYY') + '.' + ft.format('MM') + '.' + ft.format('DD') + '*';
  const size = 1000;
  const fromIndex = req.body.from && parseInt(req.body.from) || 0;
  const toIndex = fromIndex + size;
  const searchParams = {
    index: searchIndex,
    body: {
      from: req.body.from || 0,
      size: size,
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
        errorHits.push({ log: h._source.log })
      }
    }

    console.log(req.body.from_time)
    res.render('index', {
      hits:  errorHits,
      title: 'Results for ' + req.body.customer,
      from: fromIndex,
      to: toIndex,
      customer: req.body.customer || 'acme',
      total_hits: result.body.hits.total,
      from_time: req.body.from_time,
      to_time: req.body.to_time
    });
  })

})

module.exports = router;
