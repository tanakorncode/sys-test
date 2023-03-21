const yup = require('yup')
const _ = require('lodash')
const db = require('../../core/config/mysql')
const { TB_PL_DETAIL } = require('./tables')

/**
 * tb_pl_detail
 */
class Model {
  constructor(attributes) {
    this.attributes = attributes
    this.db = db
    this.tableName = TB_PL_DETAIL
  }

  static attributeLabels() {
    return {
      pl_detail_id: 'ไอดี',
      pl_id: 'เลขที่อ้างอิง',
      pl_detail_doc_num: 'เลขที่เอกสาร',
      pl_seq: 'ลำดับ',
      pl_bulk: 'เศษเหล็กเหมากอง T / F',
      contract_yr: 'ปีสัญญาซือขาย',
      contract_no: 'เลขที่สัญญาซื้อขาย',
      com_grade_code: 'รหัสเกรด',
      owner_type: 'ประเภทรถ',
      truck_id: 'รหัสรถยนต์',
      truckwgt: 'น้ำหนักชั่งเบา',
      tot_truckwgt: 'น้ำหนักชั่งหนัก',
      tot_actwgt: 'น้ำหนักสุทธิ',
      pl_contact: 'ส่งตามสัญญา T / F',
      eff_date: 'สิ้นสุดสัญญา',
      balance: 'ยอดแผนคงเหลือ'
    }
  }

  static schemas() {
    return yup.object().shape({
      pl_detail_id: yup.number().integer(),
      pl_id: yup.number().integer().required('invalid pl_id.'),
      pl_detail_doc_num: yup.string().required(),
      pl_seq: yup.number().integer().required('invalid pl_seq.'),
      pl_bulk: yup.string().oneOf(['T', 'F']).required('invalid pl_bulk.'),
      contract_yr: yup.string().notRequired().nullable(),
      contract_no: yup.string().notRequired().nullable(),
      com_grade_code: yup.string().notRequired().nullable(),
      owner_type_id: yup.number().integer().notRequired().nullable(),
      truck_id: yup.number().integer().notRequired().nullable(),
      truckwgt: yup.number().integer().notRequired().nullable(),
      tot_truckwgt: yup.number().integer().notRequired().nullable(),
      tot_actwgt: yup.number().integer().notRequired().nullable(),
      pl_contact: yup.string().oneOf(['T', 'F']).notRequired().nullable(),
      eff_date: yup.string().notRequired().nullable(),
      balance: yup.number().notRequired().nullable()
    })
  }

  static find(columns = '*') {
    return this.db.select(columns).from(this.tableName)
  }

  static findOneById = (id) => {
    return this.find().where('pl_detail_id', id).first()
  }

  static findOne = (condition) => {
    return this.find().where(condition).first()
  }

  static deleteById(id) {
    return this.delete({ pl_detail_id: id })
  }

  static delete(params) {
    return this.db(this.tableName).where(params).del()
  }

  save() {
    if (!this.attributes) throw new Error('attributes not set.')
    const attributes = _.omit(this.attributes, ['pl_detail_id'])

    if (_.get(this.attributes, 'pl_detail_id')) {
      // update
      return this.db(this.tableName).where('pl_detail_id', this.attributes.pl_detail_id).update(attributes)
    } else {
      // create
      return this.db(this.tableName).insert(attributes)
    }
  }
}

Model.tableName = TB_PL_DETAIL
Model.db = db

module.exports = Model
