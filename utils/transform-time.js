const dayjs = require('dayjs')
const moment = require('moment')
moment.locale('th')
dayjs.locale(process.env.LOCALE)

module.exports = function (value, originalValue) {
  const isValid =
    moment(originalValue, 'HH:mm:ss').format('HH:mm:ss') === originalValue ||
    moment(originalValue, 'HH:mm').format('HH:mm') === originalValue
  // const isValid =
  //   dayjs(originalValue).format('HH:mm:ss') === originalValue || dayjs(originalValue).format('HH:mm') === originalValue
  // check to see if the previous transform already parsed the date
  if (this.isType(value) && isValid) return value
  return isValid
}
