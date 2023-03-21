const yup = require('yup')
const _ = require('lodash')
const dayjs = require('dayjs')
const transformDatetime = require('../../utils/transform-datetime')
const db = require('../../core/config/mysql')
const { TB_RET } = require('./tables')
dayjs.locale(process.env.LOCALE)

/**
 * tb_ret
 */
class Model {
  constructor(attributes) {
    this.attributes = attributes
    this.db = db
    this.tableName = TB_RET
  }

  static attributeLabels() {
    return {
      ret_id: 'ไอดี',
      ret_code: 'รหัสร้านค้าย่อย',
      ret_title: 'ชื่อต้น',
      ret_name: 'ชื่อร้านค้าย่อย',
      ret_adr1: 'ที่อยู่1',
      ret_adr2: 'ที่อยู่2',
      zip_code: 'รหัสไปรษณีย์',
      prov_code: 'รหัสจังหวัด',
      con_p: 'ชื่อผู้ติดต่อ',
      con_tel: 'เบอร์โทรศัพท์',
      fax1: 'Fax',
      ret_email: 'อีเมล',
      ret_lon: 'longitude',
      ret_lat: 'latitude',
      ret_profile: '',
      ret_status_id: 'สถานะ',
      ret_confirm: 'ยืนยัน',
      user_id: 'รหัสผู้ใช้งาน',
      created_at: 'วัน,เวลาที่บันทึก',
      updated_at: 'วัน,เวลาที่แก้ไข',
      created_by: 'ผู้บันทึก',
      updated_by: 'ผู้แก้ไข',
      tambon_id: 'รหัสตำบล',
      amphoe_id: 'รหัสอำเภอ',
      pdpa_agreement: 'ยอมรับข้อตกลง',
    }
  }

  static schemas() {
    return yup.object().shape({
      ret_id: yup.number().integer(),
      ret_code: yup.string().required(),
      ret_title: yup.string().notRequired().nullable(),
      ret_name: yup.string().required(),
      ret_adr1: yup.string().notRequired().nullable(),
      ret_adr2: yup.string().notRequired().nullable(),
      zip_code: yup.string().notRequired().nullable(),
      prov_code: yup.string().notRequired().nullable(),
      con_p: yup.string().notRequired().nullable(),
      con_tel: yup.string().notRequired().nullable(),
      fax1: yup.string().notRequired().nullable(),
      ret_email: yup.string().notRequired().nullable(),
      ret_lon: yup.string().notRequired().nullable(),
      ret_lat: yup.string().notRequired().nullable(),
      ret_profile: yup.string().notRequired().nullable(),
      ret_status_id: yup.number().integer().oneOf([1, 2]).notRequired().nullable(),
      ret_confirm: yup.string().oneOf(['T', 'F', '']).notRequired().nullable(),
      pdpa_agreement: yup.string().oneOf(['Y', 'N', '']).notRequired().nullable(),
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
      created_by: yup.number().integer().notRequired().nullable(),
      updated_by: yup.number().integer().notRequired().nullable(),
      tambon_id: yup.number().integer().notRequired().nullable(),
      amphoe_id: yup.number().integer().notRequired().nullable(),
    })
  }

  static find(columns = '*') {
    return this.db.select(columns).from(this.tableName)
  }

  static findOne(conditions = {}) {
    return this.find().where(conditions).first()
  }

  static findOneById = (id) => {
    return this.find().where('ret_id', id).first()
  }

  static deleteById(id) {
    return this.delete({ ret_id: id })
  }

  static delete(params) {
    return this.db(this.tableName).where(params).del()
  }

  save(isNewRecord = false) {
    if (!this.attributes) throw new Error('attributes not set.')
    // const attributes = _.omit(this.attributes, ['ret_id'])

    if (!isNewRecord) {
      // update
      const attributes = _.omit(this.attributes, ['created_at', 'created_by'])
      return this.db(this.tableName).where('ret_id', this.attributes.ret_id).update(attributes)
    } else {
      // create
      return this.db(this.tableName).insert(this.attributes)
    }
  }
}

Model.tableName = TB_RET
Model.db = db

module.exports = Model