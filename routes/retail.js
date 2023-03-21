var express = require('express');
var router = express.Router();
const { postImport, updateRetailAndTrader } = require('../controllers/retail')

router.post(`/import`, postImport)
router.post(`/updated-retail`, updateRetailAndTrader)

module.exports = router;