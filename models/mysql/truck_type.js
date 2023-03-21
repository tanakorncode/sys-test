const yup = require('yup')
const _ = require('lodash')
const db = require('../../core/config/mysql')
const { TB_TRUCK_TYPE } = require('./tables')

/**
 * tb_truck_type
 */
class Model {
  constructor(attributes) {
    this.attributes = attributes
    this.db = db
    this.tableName = TB_TRUCK_TYPE
  }

  static attributeLabels() {
    return {
      truck_type_id: 'ไอดี',
      truck_type: 'ประเภทรถยนต์',
      truck_name: 'ชื่อประเภทรถยนต์',
      trailer: 'มีพ่วงท้าย T=มีพ่วงท้าย F=ไม่มีพ่วงท้าย',
      stdtime_loding: 'เวลา loading (นาที)',
      base_low_wgt: '',
      max_diff_wgt: '',
      tolerance: '',
      tol_trans: '',
      truck_no_format: 'รูปแบบทะเบียนรถ',
    }
  }

  static schemas() {
    return yup.object().shape({
      truck_type_id: yup.number().integer().notRequired().nullable(),
      truck_type: yup.string().notRequired().nullable(),
      truck_name: yup.string().required('invalid truck_name.'),
      trailer: yup.string().oneOf(['T', 'F']).required('invalid trailer.').notRequired().nullable(),
      stdtime_loding: yup.number().integer().notRequired().nullable(),
      base_low_wgt: yup.number().integer().notRequired().nullable(),
      max_diff_wgt: yup.number().integer().notRequired().nullable(),
      tolerance: yup.number().integer().notRequired().nullable(),
      tol_trans: yup.number().integer().notRequired().nullable(),
      truck_no_format: yup.string().notRequired().nullable(),
    })
  }

  static find(columns = '*') {
    return this.db.select(columns).from(this.tableName)
  }

  static findOne = (condition) => {
    return this.find().where(condition).first()
  }

  static findOneById = (id) => {
    return this.find().where('truck_type_id', id).first()
  }

  static deleteById(id) {
    return this.delete({ truck_type_id: id })
  }

  static deleteByIds(ids) {
    return this.db(this.tableName).whereIn('truck_type_id', ids).del()
  }

  static delete(params) {
    return this.db(this.tableName).where(params).del()
  }

  static getTruckTypeList() {
    return this.db
      .select([
        'tb_truck_type.*',
        'tb_truck_owner_type.truck_owner_type_des',
        db.raw(`(
        SELECT
          GROUP_CONCAT( tb_plant.plant_name )
        FROM
          tb_truck_type_plant
          INNER JOIN tb_plant ON tb_plant.plant_id = tb_truck_type_plant.plant_id
        WHERE
          tb_truck_type_plant.truck_type_id = tb_truck_type.truck_type_id
        ) AS plant_name `),
      ])
      .from(this.tableName)
      .leftJoin('tb_truck_owner_type', 'tb_truck_type.truck_type', 'tb_truck_owner_type.truck_owner_type_id')
  }

  save() {
    if (!this.attributes) throw new Error('attributes not set.')
    const attributes = _.omit(this.attributes, ['truck_type_id'])

    if (_.get(this.attributes, 'truck_type_id')) {
      // update
      return this.db(this.tableName).where('truck_type_id', this.attributes.truck_type_id).update(attributes)
    } else {
      // create
      return this.db(this.tableName).insert(attributes)
    }
  }

}

Model.tableName = TB_TRUCK_TYPE
Model.db = db

module.exports = Model