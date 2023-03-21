const yup = require('yup')
const db = require('../../core/config/mysql')
const { TB_TRUCK_TYPE_PLANT } = require('./tables')
/**
 * tb_truck_type_plant
 */
class Model {
  constructor(attributes) {
    this.attributes = attributes
    this.db = db
    this.tableName = TB_TRUCK_TYPE_PLANT
  }

  static attributeLabels() {
    return {
      truck_type_id: 'ประเภทรถ',
      plant_id: 'โรงงาน',
    }
  }

  static schemas() {
    return yup.object().shape({
      truck_type_id: yup.number().integer().required(),
      plant_id: yup.number().integer().required(),
    })
  }

  static find(columns = '*') {
    return this.db.select(columns).from(this.tableName)
  }

  static getItems(params) {
    const fields = ['tb_truck_type_plant.*', 'tb_plant.plant_code', 'tb_plant.plant_name']
    if (params) {
      return this.db
        .select(fields)
        .from(this.tableName)
        .where(params)
        .innerJoin('tb_plant', 'tb_plant.plant_id', 'tb_truck_type_plant.plant_id')
    }
    return this.db
      .select(fields)
      .from(this.tableName)
      .innerJoin('tb_plant', 'tb_plant.plant_id', 'tb_truck_type_plant.plant_id')
  }

  static delete(params) {
    return this.db(this.tableName).where(params).del()
  }

  save(isNewRecord = false) {
    if (!this.attributes) throw new Error('attributes not set.')

    if (!isNewRecord) {
      // update
      return this.db(this.tableName).where(this.attributes).update(this.attributes)
    } else {
      // create
      return this.db(this.tableName).insert(this.attributes)
    }
  }
}

Model.tableName = TB_TRUCK_TYPE_PLANT
Model.db = db

module.exports = Model
