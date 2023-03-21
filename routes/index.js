var express = require('express');
var router = express.Router();
const { getFirestore } = require('firebase-admin/firestore')
const { getMessaging } = require('firebase-admin/messaging')
const { getAuth } = require('firebase-admin/auth')
const moment = require("moment")
moment.locale("th")

/* GET home page. */
router.get('/', function (req, res, next) {
  res.render('index', { title: 'Express' });
});

router.get('/send-message', async (req, res) => {
  try {
    const db = getFirestore()
    const snapshot = await db.collection('users').doc('2rWJ5FyzhNMNCGd0pYiZHffjJi12').get()
    let tokens = []
    let messages = []
    if (snapshot.data() !== null) {
      const user = snapshot.data()
      tokens = user.tokens.map((t) => t.token)
      if (user.messages && Array.isArray(user.messages)) {
        messages = user.messages
      }
    }
    let data = {
      type: 'call-queue',
      pl_id: String(3742),
      driver_id: String(6669),
      pl_doc_num: String("SC22011356"),
      plant_name: 'SYS 1',
      date: moment().format("DD/MM/YYYY HH:mm")
    }

    const messaging = getMessaging()
    await messaging.sendMulticast({
      data: data,
      tokens: tokens,
      notification: {
        title: 'เรียกคิวเข้าส่งเศษเหล็ก ใบนำส่งเลขที่ ' + String("SC22011356"),
        body: 'กรุณาส่งเศษเหล็กที่ SYS 1',
      },
    })
    messages.push(data)
    console.log(messages);
    await db.collection('users').doc('2rWJ5FyzhNMNCGd0pYiZHffjJi12').update({messages})
    // await getAuth().updateUser("2rWJ5FyzhNMNCGd0pYiZHffjJi12", { messages: messages })
    res.send('ok')
  } catch (error) {
    res.send(error)
  }
})

module.exports = router;
