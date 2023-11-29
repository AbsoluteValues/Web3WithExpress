var express = require('express');
var router = express.Router();

const {check, validationResult} = require('express-validator');

const transaction = require('./../transaction');

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index');
});

router.post('/submit',

[check('from').isByteLength({min:1, max:500})],
[check('to').isByteLength({min:1, max:500})],
[check('amount').isByteLength({min:1, max:500})],
[check('repeat').isByteLength({min:1, max:500})],

function(req, res, next) {
  let errs = validationResult(req);
  if (errs['errors'].length > 0) {
    res.render('index', {errs:errs['errors']});
  }else {
    let param = JSON.parse(JSON.stringify(req.body));
    transaction.sendTransactionsAPI(param['from'], param['to'], param['amount'], param['repeat'], (txLink) =>{
      res.render('done', {txLink:txLink});
    });
  }
});

module.exports = router;
