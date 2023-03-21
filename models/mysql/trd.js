const yup = require('yup')
const _ = require('lodash')
const dayjs = require('dayjs')
const transformDatetime = require('../../utils/transform-datetime')
const db = require('../../core/config/mysql')
const { TB_TRD } = require('./tables')
dayjs.locale(process.env.LOCALE)

/**
 * tb_trd
 */
class Model {
  constructor(attributes) {
    this.attributes = attributes
    this.db = db
    this.tableName = TB_TRD
  }

  static attributeLabels() {
    return {
      trd_id: 'ไอดี',
      trd_code: 'รหัสผู้ขายเศษเหล็ก',
      trd_title: 'ชื่อต้น',
      trd_name: 'ชื่อผู้ขายเศษเหล็ก',
      trd_adr1: 'ที่อยู่1',
      trd_adr2: 'ที่อยู่2',
      trdsap_code: '',
      prov_code: 'รหัสจังหวัด',
      zip_code: 'รหัสไปรษณีย์',
      cn_p1: 'ชื่อผู้ติดต่อ1',
      cn_p1_tel: 'เบอร์โทรผู้ติดต่อ1',
      cn_p2: 'ชื่อผู้ติดต่อ2',
      cn_p2_tel: 'เบอร์โทรผู้ติดต่อ2',
      cn_p3: 'ชื่อผู้ติดต่อ3',
      cn_p3_tel: 'เบอร์โทรผู้ติดต่อ3',
      fax1: 'Fax',
      fax2: 'Fax',
      trd_email: 'อีเมล',
      trd_profile: '',
      trd_status_id: 'สถานะ',
      user_id: 'รหัสผู้ใช้งาน',
      created_at: 'วัน,เวลาที่บันทึก',
      updated_at: 'วัน,เวลาที่แก้ไข',
      created_by: 'ผู้บันทึก',
      updated_by: 'ผู้แก้ไข',
    }
  }

  static schemas() {
    return yup.object().shape({
      trd_id: yup.number().integer(),
      trd_code: yup.string().required('invalid trd_code.'),
      trd_title: yup.string().required('invalid trd_title.'),
      trd_name: yup.string().required('invalid trd_title.'),
      trd_adr1: yup.string().notRequired().nullable(),
      trd_adr2: yup.string().notRequired().nullable(),
      trdsap_code: yup.string().notRequired().nullable(),
      prov_code: yup.string().notRequired().nullable(),
      zip_code: yup.string().notRequired().nullable(),
      cn_p1: yup.string().notRequired().nullable(),
      cn_p1_tel: yup.string().notRequired().nullable(),
      cn_p2: yup.string().notRequired().nullable(),
      cn_p2_tel: yup.string().notRequired().nullable(),
      cn_p3: yup.string().notRequired().nullable(),
      cn_p3_tel: yup.string().notRequired().nullable(),
      fax1: yup.string().notRequired().nullable(),
      fax2: yup.string().notRequired().nullable(),
      trd_email: yup.string().notRequired().nullable(),
      trd_profile: yup.string().notRequired().nullable(),
      trd_status_id: yup.number().integer().notRequired().nullable(),
      user_id: yup.number().integer().notRequired().nullable(),
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
    return this.find().where('trd_id', id).first()
  }

  static deleteById(id) {
    return this.delete({ trd_id: id })
  }

  static delete(params) {
    return this.db(this.tableName).where(params).del()
  }

  save(isNewRecord = false) {
    if (!this.attributes) throw new Error('attributes not set.')
    // const attributes = _.omit(this.attributes, ['trd_id'])

    if (!isNewRecord) {
      // update
      const attributes = _.omit(this.attributes, ['created_at', 'created_by'])
      return this.db(this.tableName).where('trd_id', this.attributes.trd_id).update(attributes)
    } else {
      // create
      return this.db(this.tableName).insert(this.attributes)
    }
  }
}

Model.tableName = TB_TRD
Model.db = db

module.exports = Model