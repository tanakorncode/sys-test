const yup = require('yup')
const _ = require('lodash')
const dayjs = require('dayjs')
const db = require('../../core/config/mysql')
const transformDate = require('../../utils/transform-date')
const transformDatetime = require('../../utils/transform-datetime')
const { TB_PC_PLAN } = require('./tables')
dayjs.locale(process.env.LOCALE)

/**
 * tb_schedule
 */
class Model {
  constructor(attributes) {
    this.attributes = attributes
    this.db = db
    this.tableName = TB_PC_PLAN
  }

  static attributeLabels() {
    return {
      pc_plan_id: 'ไอดี',
      pc_date: 'วันที่',
      created_at: 'วัน,เวลาที่บันทึก',
      updated_at: 'วัน,เวลาที่แก้ไข',
      created_by: 'ผู้บันทึก',
      updated_by: 'ผู้แก้ไข',
    }
  }

  static schemas() {
    return yup.object().shape({
      pc_plan_id: yup.number().integer(),
      pc_date: yup.date().required('invalid pc_date.').transform(transformDate),
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
    return this.find().where('pc_plan_id', id).first()
  }

  static deleteById(id) {
    return this.delete({ pc_plan_id: id })
  }

  static delete(params) {
    return this.db(this.tableName).where(params).del()
  }

  save() {
    if (!this.attributes) throw new Error('attributes not set.')
    const attributes = _.omit(this.attributes, ['pc_plan_id'])

    if (_.get(this.attributes, 'pc_plan_id')) {
      // update
      return this.db(this.tableName)
        .where('pc_plan_id', this.attributes.pc_plan_id)
        .update(_.omit(attributes, ['created_at']))
    } else {
      // create
      return this.db(this.tableName).insert(attributes)
    }
  }

  static getPcPlanList() {
    return this.db
      .select([
        'tb_pc_plan.*',
        'tb_pc_plan_detail.pc_plan_detail_id',
        'tb_pc_plan_detail.plant_id',
        'tb_pc_plan_detail.pc_capacity',
        'tb_pc_prd_qty.pc_prd_qty_id',
        'tb_pc_prd_qty.prd_grade_id',
        'tb_pc_prd_qty.prd_grade_qty',
        'tb_prd_grade.prd_grade',
        'tb_plant.plant_code',
        'tb_plant.plant_name',
        // this.db.raw(`(
        // SELECT
        //   SUM( tb_pl_detail.tot_actwgt )
        // FROM
        //   tb_pl_detail
        //   INNER JOIN tb_pl ON tb_pl.pl_id = tb_pl_detail.pl_id
        //   INNER JOIN tb_plant ON tb_pl.plant_code = tb_plant.plant_code
        // WHERE
        //   tb_pl.ship_date = tb_pc_plan.pc_date
        //   AND tb_plant.plant_id = tb_pc_plan_detail.plant_id
        // ) AS total_tot_actwgt`),
        // this.db.raw(`(
        //   SELECT
        //     IFNULL(SUM( tb_pl_detail.tot_actwgt ), 0)
        //   FROM
        //     tb_pl_detail
        //     INNER JOIN tb_pl ON tb_pl.pl_id = tb_pl_detail.pl_id
        //     LEFT JOIN tb_plant ON tb_pl.plant_id = tb_plant.plant_id
        //     LEFT JOIN tb_grade ON tb_pl_detail.com_grade_code = tb_grade.com_grade_code
        //     LEFT JOIN tb_prd_grade as prd_grade ON tb_grade.prd_grade_id = prd_grade.prd_grade_id
        //   WHERE
        //     tb_pl.ship_date = tb_pc_plan.pc_date
        //     AND tb_plant.plant_id = tb_pc_plan_detail.plant_id
        //     AND prd_grade.prd_grade_id = tb_pc_prd_qty.prd_grade_id
        //     AND tb_pl.doc_status = 1
        //   ) AS total_tot_actwgt`),
        this.db.raw(`(
          SELECT
            IFNULL( SUM( tb_pl_detail.tot_actwgt ), 0 )
          FROM
            tb_pl_detail
            INNER JOIN tb_pl ON tb_pl.pl_id = tb_pl_detail.pl_id
            INNER JOIN tb_plant ON tb_pl.plant_id = tb_plant.plant_id
            INNER JOIN tb_grade ON tb_pl_detail.com_grade_code = tb_grade.com_grade_code
            INNER JOIN tb_prd_grade AS prd_grade ON tb_grade.prd_grade_id = prd_grade.prd_grade_id
          WHERE
            tb_pl.ship_date = tb_pc_plan.pc_date
            AND tb_plant.plant_id = tb_pc_plan_detail.plant_id
            AND prd_grade.prd_grade_id = tb_prd_grade.prd_grade_id
            AND tb_pl.doc_status = 1
            AND tb_pl.same_grade = 1
            AND tb_pl_detail.pl_seq = 1
            AND tb_pl.shipment_status_id NOT IN ( 10, 11, 3 )
          ) AS total_tot_actwgt_1`),
        this.db.raw(`(
          SELECT
            IFNULL( SUM( tb_pl_detail.tot_actwgt ), 0 )
          FROM
            tb_pl_detail
            INNER JOIN tb_pl ON tb_pl.pl_id = tb_pl_detail.pl_id
            INNER JOIN tb_plant ON tb_pl.plant_id = tb_plant.plant_id
            INNER JOIN tb_grade ON tb_pl_detail.com_grade_code = tb_grade.com_grade_code
            INNER JOIN tb_prd_grade AS prd_grade ON tb_grade.prd_grade_id = prd_grade.prd_grade_id
          WHERE
            tb_pl.ship_date = tb_pc_plan.pc_date
            AND tb_plant.plant_id = tb_pc_plan_detail.plant_id
            AND prd_grade.prd_grade_id = tb_prd_grade.prd_grade_id
            AND tb_pl.doc_status = 1
            AND tb_pl.same_grade = 0
            AND tb_pl.shipment_status_id NOT IN ( 10, 11, 3 )
          ) AS total_tot_actwgt_2`),
        this.db.raw(`(
          SELECT
            IFNULL( SUM( tb_pc_prd_qty.prd_grade_qty ), 0 )
          FROM
            tb_pc_prd_qty
            INNER JOIN tb_pc_plan_detail AS pc_plan_detail ON pc_plan_detail.pc_plan_detail_id = tb_pc_prd_qty.pc_plan_detail_id
            INNER JOIN tb_pc_plan AS pc_plan ON pc_plan.pc_plan_id = pc_plan_detail.pc_plan_id
          WHERE
            pc_plan.pc_date = tb_pc_plan.pc_date
          ) AS sum_prd_grade_qty`),
        // this.db.raw(`(
        //   SELECT
        //     IFNULL( SUM( tb_pl_detail.tot_actwgt ), 0 )
        //   FROM
        //     tb_pl_detail
        //     INNER JOIN tb_pl ON tb_pl_detail.pl_id = tb_pl.pl_id
        //     LEFT JOIN tb_grade ON tb_pl_detail.com_grade_code = tb_grade.com_grade_code
        //     LEFT JOIN tb_prd_grade ON tb_grade.prd_grade_id = tb_prd_grade.prd_grade_id
        //   WHERE
        //     tb_pl.ship_date = tb_pc_plan.pc_date
        //     AND tb_pl.doc_status = 1
        //     AND tb_prd_grade.prd_grade_id IN (
        //     SELECT
        //       GROUP_CONCAT( tb_pc_prd_qty.prd_grade_id )
        //     FROM
        //       tb_pc_prd_qty
        //       INNER JOIN tb_pc_plan_detail ON tb_pc_plan_detail.pc_plan_detail_id = tb_pc_prd_qty.pc_plan_detail_id
        //       INNER JOIN tb_pc_plan ON tb_pc_plan.pc_plan_id = tb_pc_plan_detail.pc_plan_id
        //     WHERE
        //       tb_pc_plan.pc_date = tb_pc_plan.pc_date
        //     )
        //   GROUP BY
        //     tb_pl.ship_date
        //   ) AS sum_tot_actwgt`),
        this.db.raw(`((
          SELECT
            IFNULL( SUM( tb_pl_detail.tot_actwgt ), 0 )
          FROM
            tb_pl_detail
            INNER JOIN tb_pl ON tb_pl.pl_id = tb_pl_detail.pl_id
            INNER JOIN tb_plant ON tb_pl.plant_id = tb_plant.plant_id
            INNER JOIN tb_grade ON tb_pl_detail.com_grade_code = tb_grade.com_grade_code
            INNER JOIN tb_prd_grade AS prd_grade ON tb_grade.prd_grade_id = prd_grade.prd_grade_id
          WHERE
            tb_pl.ship_date = tb_pc_plan.pc_date
            AND tb_plant.plant_id = tb_pc_plan_detail.plant_id
            AND prd_grade.prd_grade_id = tb_prd_grade.prd_grade_id
            AND tb_pl.doc_status = 1
            AND tb_pl.same_grade = 1
            AND tb_pl_detail.pl_seq = 1
            AND tb_pl.shipment_status_id NOT IN ( 10, 11, 3 )
            ) + (
          SELECT
            IFNULL( SUM( tb_pl_detail.tot_actwgt ), 0 )
          FROM
            tb_pl_detail
            INNER JOIN tb_pl ON tb_pl.pl_id = tb_pl_detail.pl_id
            INNER JOIN tb_plant ON tb_pl.plant_id = tb_plant.plant_id
            INNER JOIN tb_grade ON tb_pl_detail.com_grade_code = tb_grade.com_grade_code
            INNER JOIN tb_prd_grade AS prd_grade ON tb_grade.prd_grade_id = prd_grade.prd_grade_id
          WHERE
            tb_pl.ship_date = tb_pc_plan.pc_date
            AND tb_plant.plant_id = tb_pc_plan_detail.plant_id
            AND prd_grade.prd_grade_id = tb_prd_grade.prd_grade_id
            AND tb_pl.doc_status = 1
            AND tb_pl.same_grade = 0
            AND tb_pl.shipment_status_id NOT IN ( 10, 11, 3 )
          )) AS sum_tot_actwgt`),
        this.db.raw(
          `CONCAT( DATE_FORMAT( DATE_ADD( tb_pc_plan.pc_date, INTERVAL 543 YEAR ), '%d/%m/%Y' ), ' ', tb_plant.plant_name ) AS group_name`
        ),
      ])
      .from(this.tableName)
      .leftJoin('tb_pc_plan_detail', 'tb_pc_plan.pc_plan_id', 'tb_pc_plan_detail.pc_plan_id')
      .leftJoin('tb_pc_prd_qty', 'tb_pc_plan_detail.pc_plan_detail_id', 'tb_pc_prd_qty.pc_plan_detail_id')
      .leftJoin('tb_prd_grade', 'tb_pc_prd_qty.prd_grade_id', 'tb_prd_grade.prd_grade_id')
      .leftJoin('tb_plant', 'tb_pc_plan_detail.plant_id', 'tb_plant.plant_id')
      .orderBy('tb_pc_plan.pc_date', 'desc')
      .orderBy('tb_pc_plan.pc_plan_id', 'asc')
  }

  static getPcPlanListByShipdate(shipdate) {
    return this.db
      .select(['tb_pc_plan.*'])
      .from(this.tableName)
      .leftJoin('tb_pc_plan_detail', 'tb_pc_plan.pc_plan_id', 'tb_pc_plan_detail.pc_plan_id')
      .leftJoin('tb_pc_prd_qty', 'tb_pc_plan_detail.pc_plan_detail_id', 'tb_pc_prd_qty.pc_plan_detail_id')
      .leftJoin('tb_prd_grade', 'tb_pc_prd_qty.prd_grade_id', 'tb_prd_grade.prd_grade_id')
      .leftJoin('tb_plant', 'tb_pc_plan_detail.plant_id', 'tb_plant.plant_id')
      .where({ 'tb_pc_plan.pc_date': shipdate })
  }

  static getDataBooking() {
    return this.db
      .select([
        'tb_pc_plan.pc_date',
        this.db.raw(`SUM( tb_pc_prd_qty.prd_grade_qty ) AS pc_capacity`),
        'tb_plant.plant_code',
        'tb_plant.plant_name',
        'tb_pc_prd_qty.prd_grade_qty',
        // this.db.raw(`(
        // SELECT
        //   IFNULL( SUM( tb_pl_detail.tot_actwgt ), 0 )
        // FROM
        //   tb_pl_detail
        //   INNER JOIN tb_pl ON tb_pl.pl_id = tb_pl_detail.pl_id
        //   LEFT JOIN tb_plant ON tb_pl.plant_id = tb_plant.plant_id
        //   LEFT JOIN tb_grade ON tb_pl_detail.com_grade_code = tb_grade.com_grade_code
        //   LEFT JOIN tb_prd_grade AS prd_grade ON tb_grade.prd_grade_id = prd_grade.prd_grade_id
        // WHERE
        //   tb_pl.ship_date = tb_pc_plan.pc_date
        //   AND tb_plant.plant_id = tb_pc_plan_detail.plant_id
        //   AND prd_grade.prd_grade_id = tb_pc_prd_qty.prd_grade_id
        //   AND tb_pl.doc_status = 1
        // ) AS total_tot_actwgt`),
        this.db.raw(`(
          SELECT
            IFNULL( SUM( tb_pl_detail.tot_actwgt ), 0 )
          FROM
            tb_pl_detail
            INNER JOIN tb_pl ON tb_pl.pl_id = tb_pl_detail.pl_id
            INNER JOIN tb_plant ON tb_pl.plant_id = tb_plant.plant_id
            INNER JOIN tb_grade ON tb_pl_detail.com_grade_code = tb_grade.com_grade_code
            INNER JOIN tb_prd_grade AS prd_grade ON tb_grade.prd_grade_id = prd_grade.prd_grade_id
          WHERE
            tb_pl.ship_date = tb_pc_plan.pc_date
            AND tb_plant.plant_id = tb_pc_plan_detail.plant_id
            AND prd_grade.prd_grade_id = tb_prd_grade.prd_grade_id
            AND tb_pl.doc_status = 1
            AND tb_pl.same_grade = 1
            AND tb_pl_detail.pl_seq = 1
            AND tb_pl.shipment_status_id NOT IN ( 10, 11, 3 )
          ) AS total_tot_actwgt_1`),
        this.db.raw(`(
          SELECT
            IFNULL( SUM( tb_pl_detail.tot_actwgt ), 0 )
          FROM
            tb_pl_detail
            INNER JOIN tb_pl ON tb_pl.pl_id = tb_pl_detail.pl_id
            INNER JOIN tb_plant ON tb_pl.plant_id = tb_plant.plant_id
            INNER JOIN tb_grade ON tb_pl_detail.com_grade_code = tb_grade.com_grade_code
            INNER JOIN tb_prd_grade AS prd_grade ON tb_grade.prd_grade_id = prd_grade.prd_grade_id
          WHERE
            tb_pl.ship_date = tb_pc_plan.pc_date
            AND tb_plant.plant_id = tb_pc_plan_detail.plant_id
            AND prd_grade.prd_grade_id = tb_prd_grade.prd_grade_id
            AND tb_pl.doc_status = 1
            AND tb_pl.same_grade = 0
            AND tb_pl.shipment_status_id NOT IN ( 10, 11, 3 )
          ) AS total_tot_actwgt_2`),
        this.db.raw(`(
          SELECT
            IFNULL( SUM( tb_pc_prd_qty.prd_grade_qty ), 0 )
          FROM
            tb_pc_prd_qty
            INNER JOIN tb_pc_plan_detail AS pc_plan_detail ON pc_plan_detail.pc_plan_detail_id = tb_pc_prd_qty.pc_plan_detail_id
            INNER JOIN tb_pc_plan AS pc_plan ON pc_plan.pc_plan_id = pc_plan_detail.pc_plan_id
          WHERE
            pc_plan.pc_date = tb_pc_plan.pc_date
            AND pc_plan.pc_plan_id = tb_pc_plan.pc_plan_id AND
            pc_plan_detail.plant_id = tb_plant.plant_id
          ) AS sum_prd_grade_qty`),
        this.db.raw(`((
          SELECT
            IFNULL( SUM( tb_pl_detail.tot_actwgt ), 0 )
          FROM
            tb_pl_detail
            INNER JOIN tb_pl ON tb_pl.pl_id = tb_pl_detail.pl_id
            INNER JOIN tb_plant ON tb_pl.plant_id = tb_plant.plant_id
            INNER JOIN tb_grade ON tb_pl_detail.com_grade_code = tb_grade.com_grade_code
            INNER JOIN tb_prd_grade AS prd_grade ON tb_grade.prd_grade_id = prd_grade.prd_grade_id
          WHERE
            tb_pl.ship_date = tb_pc_plan.pc_date
            AND tb_plant.plant_id = tb_pc_plan_detail.plant_id
            AND prd_grade.prd_grade_id = tb_prd_grade.prd_grade_id
            AND tb_pl.doc_status = 1
            AND tb_pl.same_grade = 1
            AND tb_pl_detail.pl_seq = 1
            AND tb_pl.shipment_status_id NOT IN ( 10, 11, 3 )
          ) + (
            SELECT
              IFNULL( SUM( tb_pl_detail.tot_actwgt ), 0 )
            FROM
              tb_pl_detail
              INNER JOIN tb_pl ON tb_pl.pl_id = tb_pl_detail.pl_id
              INNER JOIN tb_plant ON tb_pl.plant_id = tb_plant.plant_id
              INNER JOIN tb_grade ON tb_pl_detail.com_grade_code = tb_grade.com_grade_code
              INNER JOIN tb_prd_grade AS prd_grade ON tb_grade.prd_grade_id = prd_grade.prd_grade_id
            WHERE
              tb_pl.ship_date = tb_pc_plan.pc_date
              AND tb_plant.plant_id = tb_pc_plan_detail.plant_id
              AND prd_grade.prd_grade_id = tb_prd_grade.prd_grade_id
              AND tb_pl.doc_status = 1
              AND tb_pl.same_grade = 0
              AND tb_pl.shipment_status_id NOT IN ( 10, 11, 3 )
            )) AS sum_tot_actwgt`),
        this.db.raw(
          `CONCAT( DATE_FORMAT( DATE_ADD( tb_pc_plan.pc_date, INTERVAL 543 YEAR ), '%d/%m/%Y' ), ' ', tb_plant.plant_name ) AS group_name`
        ),
      ])
      .from('tb_pc_plan')
      .innerJoin('tb_pc_plan_detail', 'tb_pc_plan.pc_plan_id', 'tb_pc_plan_detail.pc_plan_id')
      .innerJoin('tb_pc_prd_qty', 'tb_pc_plan_detail.pc_plan_detail_id', 'tb_pc_prd_qty.pc_plan_detail_id')
      .leftJoin('tb_prd_grade', 'tb_pc_prd_qty.prd_grade_id', 'tb_prd_grade.prd_grade_id')
      .innerJoin('tb_plant', 'tb_pc_plan_detail.plant_id', 'tb_plant.plant_id')
      .groupBy('tb_pc_plan_detail.plant_id')
      .groupBy('tb_pc_plan.pc_date')
    // .whereBetween('tb_pc_plan.pc_date', [start, end])
    // .where('tb_pc_plan_detail.plant_id', plantId)
  }

  static getBookingsManage(shipDate, plantId, gradeId) {
    return this.db
      .select([
        'tb_prd_grade.*',
        this.db.raw(`(
        SELECT
          IFNULL( SUM( tb_pl_detail.tot_actwgt ), 0 )
        FROM
          tb_pl_detail
          INNER JOIN tb_pl ON tb_pl.pl_id = tb_pl_detail.pl_id
          INNER JOIN tb_plant ON tb_pl.plant_id = tb_plant.plant_id
          INNER JOIN tb_grade ON tb_pl_detail.com_grade_code = tb_grade.com_grade_code
          INNER JOIN tb_prd_grade AS prd_grade ON tb_grade.prd_grade_id = prd_grade.prd_grade_id
        WHERE
          tb_pl.ship_date = '${shipDate}'
          AND tb_plant.plant_id = (${plantId})
          AND prd_grade.prd_grade_id = tb_prd_grade.prd_grade_id
          AND tb_pl.doc_status = 1
          AND tb_pl.same_grade = 1
          AND tb_pl_detail.pl_seq = 1
          AND tb_pl.shipment_status_id NOT IN ( 10, 11, 3 )
        ) AS total_tot_actwgt_1`),
        this.db.raw(`(
          SELECT
            IFNULL( SUM( tb_pl_detail.tot_actwgt ), 0 )
          FROM
            tb_pl_detail
            INNER JOIN tb_pl ON tb_pl.pl_id = tb_pl_detail.pl_id
            INNER JOIN tb_plant ON tb_pl.plant_id = tb_plant.plant_id
            INNER JOIN tb_grade ON tb_pl_detail.com_grade_code = tb_grade.com_grade_code
            INNER JOIN tb_prd_grade AS prd_grade ON tb_grade.prd_grade_id = prd_grade.prd_grade_id
          WHERE
            tb_pl.ship_date = '${shipDate}'
            AND tb_plant.plant_id = (${plantId})
            AND prd_grade.prd_grade_id = tb_prd_grade.prd_grade_id
            AND tb_pl.doc_status = 1
            AND tb_pl.same_grade = 0
            AND tb_pl.shipment_status_id NOT IN ( 10, 11, 3 )
          ) AS total_tot_actwgt_2`),
        this.db.raw(`(
            SELECT
              IFNULL( SUM( tb_pc_prd_qty.prd_grade_qty ), 0 )
            FROM
              tb_pc_prd_qty
              INNER JOIN tb_prd_grade AS prd_grade ON tb_pc_prd_qty.prd_grade_id = prd_grade.prd_grade_id
              INNER JOIN tb_pc_plan_detail ON tb_pc_prd_qty.pc_plan_detail_id = tb_pc_plan_detail.pc_plan_detail_id
              INNER JOIN tb_pc_plan ON tb_pc_plan_detail.pc_plan_id = tb_pc_plan.pc_plan_id
              INNER JOIN tb_plant ON tb_pc_plan_detail.plant_id = tb_plant.plant_id
            WHERE
              tb_pc_plan.pc_date = '${shipDate}'
              AND tb_pc_prd_qty.prd_grade_id = tb_prd_grade.prd_grade_id
              AND tb_pc_plan_detail.plant_id = (${plantId})
            ) AS prd_grade_qty`),
      ])
      .from('tb_prd_grade')
      .where({ 'tb_prd_grade.prd_grade_id': gradeId })
    // .whereIn('tb_prd_grade.prd_grade_id', gradeIds)
  }

  static getRetFixplant(retId) {
    return this.db
      .select([
        'tb_ret.ret_code',
        db.raw(`concat( tb_ret.ret_title, ' ', tb_ret.ret_name ) as ret_name`),
        'tb_ret_fixplant.*',
        'tb_itemstatus.itemstatus_des',
        'tb_plant.plant_name',
      ])
      .from('tb_ret_fixplant')
      .where({
        'tb_ret.ret_id': retId,
        'tb_ret_fixplant.ret_fixplant_status_id': 1,
      })
      .andWhere('tb_plant.plant_status', 'Y')
      .innerJoin('tb_ret', 'tb_ret.ret_id', 'tb_ret_fixplant.ret_id')
      .innerJoin('tb_itemstatus', 'tb_itemstatus.itemstatus_id', 'tb_ret_fixplant.ret_fixplant_status_id')
      .innerJoin('tb_plant', 'tb_ret_fixplant.plant_id', 'tb_plant.plant_id')
  }
}

Model.tableName = TB_PC_PLAN
Model.db = db

module.exports = Model
