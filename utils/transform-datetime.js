const dayjs = require('dayjs')
dayjs.locale(process.env.LOCALE)

module.exports = function (value, originalValue) {
  const isValid = dayjs(originalValue).format('YYYY-MM-DD HH:mm:ss') === originalValue
  // check to see if the previous transform already parsed the date
  if (this.isType(value) && isValid) return value
  return isValid
}
