var express = require('express');
var router = express.Router();
const { postCheckPlan, getSlotTimes } = require('../controllers/pl')

/* GET users listing. */
router.get('/', function(req, res, next) {
  res.send('respond with a resource');
});

router.post(`/check-plan`, postCheckPlan)
router.get(`/slot-time-avalible`, getSlotTimes)

module.exports = router;