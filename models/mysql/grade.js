const yup = require('yup')
// const _ = require('lodash')
const dayjs = require('dayjs')
const transformDatetime = require('../../utils/transform-datetime')
const db = require('../../core/config/mysql')
const { TB_GRADE } = require('./tables')
dayjs.locale(process.env.LOCALE)

/**
 * tb_grade
 */
class Model {
  constructor(attributes) {
    this.attributes = attributes
    this.db = db
    this.tableName = TB_GRADE
  }

  static attributeLabels() {
    return {
      com_grade_code: 'รหัสเกรด',
      com_grade_name: 'ชื่อเกรด',
      com_groupgrade_code: '',
      source: '',
      prd_grade_code: '',
      created_by: '',
      created_at: '',
      prd_grade_id: '',
      updated_at: '',
      updated_by: ''
    }
  }

  static schemas() {
    return yup.object().shape({
      com_grade_code: yup.string().required('invalid com_grade_code.'),
      com_grade_name: yup.string().required('invalid com_grade_name.'),
      com_groupgrade_code: yup.string().notRequired().nullable(),
      source: yup.string().notRequired().nullable(),
      prd_grade_code: yup.string().notRequired().nullable(),
      created_by: yup.string().notRequired().nullable(),
      created_at: yup
        .string()
        .notRequired()
        .transform(transformDatetime)
        .default(() => dayjs().format('YYYY-MM-DD HH:mm:ss')),
      prd_grade_id: yup.number().integer().notRequired().nullable(),
      updated_by: yup.number().integer().notRequired().nullable(),
      updated_at: yup
        .string()
        .notRequired()
        .transform(transformDatetime)
        .default(() => dayjs().format('YYYY-MM-DD HH:mm:ss')),
    })
  }

  static find(columns = '*') {
    return this.db.select(columns).from(this.tableName)
  }

  static findOne(conditions = {}) {
    return this.find().where(conditions).first()
  }

  static getGradeList() {
    return this.db
      .select(['tb_grade.*', 'tb_prd_grade.*'])
      .from(this.tableName)
      .leftJoin('tb_prd_grade', 'tb_prd_grade.prd_grade_id', 'tb_grade.prd_grade_id')
  }

  static findOneById = (id) => {
    return this.find().where('com_grade_code', id).first()
  }

  static deleteById(id) {
    return this.delete({ com_grade_code: id })
  }

  static delete(params) {
    return this.db(this.tableName).where(params).del()
  }

  save(isNewRecord = false) {
    if (!this.attributes) throw new Error('attributes not set.')
    // const attributes = _.omit(this.attributes, ['com_grade_code'])

    if (!isNewRecord) {
      // update
      return this.db(this.tableName).where('com_grade_code', this.attributes.com_grade_code).update(this.attributes)
    } else {
      // create
      return this.db(this.tableName).insert(this.attributes)
    }
  }
}

Model.tableName = TB_GRADE
Model.db = db

module.exports = Model
