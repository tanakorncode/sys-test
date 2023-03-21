const yup = require('yup')
const _ = require('lodash')
const dayjs = require('dayjs')
const transformDatetime = require('../../utils/transform-datetime')
const db = require('../../core/config/mysql')
const { TB_TRD_CONFIRM } = require('./tables')
dayjs.locale(process.env.LOCALE)

/**
 * tb_ret
 */
class Model {
  constructor(attributes) {
    this.attributes = attributes
    this.db = db
    this.tableName = TB_TRD_CONFIRM
  }

  static attributeLabels() {
    return {
      trd_confirm_id: 'ไอดี',
      trd_id: 'รหัสผู้ขายเศษเหล็ก',
      ret_id: 'รหัสร้านค้า',
      confirm_status: 'ยืนยัน',
      created_at: 'วัน,เวลาที่บันทึก',
      updated_at: 'วัน,เวลาที่แก้ไข',
      created_by: 'ผู้บันทึก',
      updated_by: 'ผู้แก้ไข',
    }
  }

  static schemas() {
    return yup.object().shape({
      trd_confirm_id: yup.number().integer().notRequired(),
      trd_id: yup.number().integer().required('invalid trd_id.'),
      ret_id: yup.number().integer().required('invalid ret_id.'),
      confirm_status: yup.string().oneOf(['Y', 'N']).required('invalid confirm_status.'),
      created_at: yup
        .string()
        .notRequired()
        .transform(transformDatetime)
        .default(() => dayjs().format('YYYY-MM-DD HH:mm:ss')),
      updated_at: yup
        .string()
        .notRequired()
        .transform(transformDatetime)
        .default(() => dayjs().format('YYYY-MM-DD HH:mm:ss')),
      created_by: yup.number().integer(),
      updated_by: yup.number().integer(),
    })
  }

  static find(columns = '*') {
    return this.db.select(columns).from(this.tableName)
  }

  static findOne(conditions = {}) {
    return this.find().where(conditions).first()
  }

  static findOneById = (id) => {
    return this.find().where('trd_confirm_id', id).first()
  }

  static deleteById(id) {
    return this.delete({ trd_confirm_id: id })
  }

  static delete(params) {
    return this.db(this.tableName).where(params).del()
  }

  save(isNewRecord = false) {
    if (!this.attributes) throw new Error('attributes not set.')
    // const attributes = _.omit(this.attributes, ['trd_confirm_id'])

    if (!isNewRecord) {
      // update
      const attributes = _.omit(this.attributes, ['created_at', 'created_by'])
      return this.db(this.tableName).where('trd_confirm_id', this.attributes.trd_confirm_id).update(attributes)
    } else {
      // create
      return this.db(this.tableName).insert(this.attributes)
    }
  }

  static updateRetailNotConfirm(retailId, trdId) {
    return this.db(this.tableName)
      .where('ret_id', retailId)
      .whereNot('trd_id', trdId)
      .update({ confirm_status: 'N' })
  }
}

Model.tableName = TB_TRD_CONFIRM
Model.db = db

module.exports = Model