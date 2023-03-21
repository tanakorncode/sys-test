const yup = require('yup')
const _ = require('lodash')
const db = require('../../core/config/mysql')
const { TB_PRD_GRADE } = require('./tables')

/**
 * tb_grade
 */
class Model {
  constructor(attributes) {
    this.attributes = attributes
    this.db = db
    this.tableName = TB_PRD_GRADE
  }

  static attributeLabels() {
    return {
      prd_grade_id: 'ไอดี',
      prd_grade: 'รหัสเกรด',
      begin_time: 'เวลาเริ่ม',
      end_time: 'เวลาสิ้นสุด'
    }
  }

  static schemas() {
    return yup.object().shape({
      prd_grade_id: yup.number().integer().notRequired(),
      prd_grade: yup.string().required('invalid prd_grade.'),
      begin_time: yup.string().required(),
      end_time: yup.string().required(),
    })
  }

  static find(columns = '*') {
    return this.db.select(columns).from(this.tableName)
  }

  static findOneById = (id) => {
    return this.find().where('prd_grade_id', id).first()
  }

  static findOne = (conditions = {}) => {
    return this.find().where(conditions).first()
  }

  static deleteById(id) {
    return this.delete({ prd_grade_id: id })
  }

  static delete(params) {
    return this.db(this.tableName).where(params).del()
  }

  save() {
    if (!this.attributes) throw new Error('attributes not set.')
    const attributes = _.omit(this.attributes, ['prd_grade_id'])

    if (_.get(this.attributes, 'prd_grade_id')) {
      // update
      return this.db(this.tableName).where('prd_grade_id', this.attributes.prd_grade_id).update(attributes)
    } else {
      // create
      return this.db(this.tableName).insert(attributes)
    }
  }
}

Model.tableName = TB_PRD_GRADE
Model.db = db

module.exports = Model
