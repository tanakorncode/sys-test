
const _ = require('lodash')
const dayjs = require('dayjs')
const db = require('../../core/config/mysql')
const { TB_PL } = require('./tables')
dayjs.locale(process.env.LOCALE)

/**
 * tb_pl
 */
class Model {
  constructor(attributes) {
    this.attributes = attributes
    this.db = db
    this.tableName = TB_PL
  }

  static find(columns = '*') {
    return this.db.select(columns).from(this.tableName)
  }

  static findOne(condition) {
    return this.find().where(condition).first()
  }

  static findOneById = (id) => {
    return this.find().where('pl_id', id).first()
  }

  static getPcPlanList2(shipdate, prdgradeid, plId = null) {
    if (plId) {
      return this.db
        .select([
          'tb_pc_plan.pc_date',
          'tb_pc_plan_detail.plant_id',
          'tb_pc_plan_detail.pc_capacity',
          'tb_plant.plant_code',
          'tb_plant.plant_name',
          'tb_pc_prd_qty.prd_grade_qty',
          'tb_prd_grade.prd_grade',
          this.db.raw(`(
          SELECT
            IFNULL( SUM( tb_pl_detail.tot_actwgt ), 0 )
          FROM
            tb_pl_detail
            INNER JOIN tb_pl ON tb_pl.pl_id = tb_pl_detail.pl_id
            LEFT JOIN tb_plant ON tb_pl.plant_id = tb_plant.plant_id
            LEFT JOIN tb_grade ON tb_pl_detail.com_grade_code = tb_grade.com_grade_code
            LEFT JOIN tb_prd_grade AS prd_grade ON tb_grade.prd_grade_id = prd_grade.prd_grade_id
          WHERE
            tb_pl.ship_date = tb_pc_plan.pc_date
            AND tb_plant.plant_id = tb_pc_plan_detail.plant_id
            AND prd_grade.prd_grade_id = tb_pc_prd_qty.prd_grade_id
            AND tb_pl_detail.pl_id <> ${plId}
            AND tb_pl.shipment_status_id NOT IN ( 10, 11, 3 )
            AND tb_pl.doc_status = 1
          ) AS total_tot_actwgt`),
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
              AND tb_pl_detail.pl_id <> ${plId}
              AND tb_pl.shipment_status_id NOT IN ( 10, 11, 3 )
              AND UNIX_TIMESTAMP(CONCAT(tb_pl.ship_date, ' ', tb_pl.ship_time_begin)) >= UNIX_TIMESTAMP(CONCAT(tb_pl.ship_date, ' ', tb_pc_prd_qty.begin_time))
	            AND UNIX_TIMESTAMP(CONCAT(tb_pl.ship_date, ' ', tb_pl.ship_time_end)) <= UNIX_TIMESTAMP(CONCAT(tb_pl.ship_date, ' ', tb_pc_prd_qty.end_time))
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
                AND tb_pl_detail.pl_id <> ${plId}
                AND tb_pl.shipment_status_id NOT IN ( 10, 11, 3 )
                AND UNIX_TIMESTAMP(CONCAT(tb_pl.ship_date, ' ', tb_pl.ship_time_begin)) >= UNIX_TIMESTAMP(CONCAT(tb_pl.ship_date, ' ', tb_pc_prd_qty.begin_time))
	              AND UNIX_TIMESTAMP(CONCAT(tb_pl.ship_date, ' ', tb_pl.ship_time_end)) <= UNIX_TIMESTAMP(CONCAT(tb_pl.ship_date, ' ', tb_pc_prd_qty.end_time))
              ) AS total_tot_actwgt_2`),
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
                  AND tb_pl_detail.pl_id <> ${plId}
                  AND tb_pl.shipment_status_id NOT IN ( 10, 11, 3 )
                  AND UNIX_TIMESTAMP(CONCAT(tb_pl.ship_date, ' ', tb_pl.ship_time_begin)) >= UNIX_TIMESTAMP(CONCAT(tb_pl.ship_date, ' ', tb_pc_prd_qty.begin_time))
	                AND UNIX_TIMESTAMP(CONCAT(tb_pl.ship_date, ' ', tb_pl.ship_time_end)) <= UNIX_TIMESTAMP(CONCAT(tb_pl.ship_date, ' ', tb_pc_prd_qty.end_time))
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
                  AND tb_pl_detail.pl_id <> ${plId}
                  AND tb_pl.shipment_status_id NOT IN ( 10, 11, 3 )
                  AND UNIX_TIMESTAMP(CONCAT(tb_pl.ship_date, ' ', tb_pl.ship_time_begin)) >= UNIX_TIMESTAMP(CONCAT(tb_pl.ship_date, ' ', tb_pc_prd_qty.begin_time))
	                AND UNIX_TIMESTAMP(CONCAT(tb_pl.ship_date, ' ', tb_pl.ship_time_end)) <= UNIX_TIMESTAMP(CONCAT(tb_pl.ship_date, ' ', tb_pc_prd_qty.end_time))
                )) AS sum_tot_actwgt`),
        ])
        .from('tb_pc_plan')
        .leftJoin('tb_pc_plan_detail', 'tb_pc_plan.pc_plan_id', 'tb_pc_plan_detail.pc_plan_id')
        .leftJoin('tb_plant', 'tb_pc_plan_detail.plant_id', 'tb_plant.plant_id')
        .leftJoin('tb_pc_prd_qty', 'tb_pc_plan_detail.pc_plan_detail_id', 'tb_pc_prd_qty.pc_plan_detail_id')
        .leftJoin('tb_prd_grade', 'tb_pc_prd_qty.prd_grade_id', 'tb_prd_grade.prd_grade_id')
        .where({
          'tb_pc_plan.pc_date': shipdate,
          // 'tb_pc_plan_detail.plant_id': plantid,
          'tb_pc_prd_qty.prd_grade_id': prdgradeid,
        })
      // .having('sum_tot_actwgt', '<', this.db.raw('prd_grade_qty'))
    } else {
      return this.db
        .select([
          'tb_pc_plan.pc_date',
          'tb_pc_plan_detail.plant_id',
          'tb_pc_plan_detail.pc_capacity',
          'tb_plant.plant_code',
          'tb_plant.plant_name',
          'tb_pc_prd_qty.prd_grade_qty',
          'tb_prd_grade.prd_grade',
          this.db.raw(`(
          SELECT
            IFNULL( SUM( tb_pl_detail.tot_actwgt ), 0 )
          FROM
            tb_pl_detail
            INNER JOIN tb_pl ON tb_pl.pl_id = tb_pl_detail.pl_id
            LEFT JOIN tb_plant ON tb_pl.plant_id = tb_plant.plant_id
            LEFT JOIN tb_grade ON tb_pl_detail.com_grade_code = tb_grade.com_grade_code
            LEFT JOIN tb_prd_grade AS prd_grade ON tb_grade.prd_grade_id = prd_grade.prd_grade_id
          WHERE
            tb_pl.ship_date = tb_pc_plan.pc_date
            AND tb_plant.plant_id = tb_pc_plan_detail.plant_id
            AND prd_grade.prd_grade_id = tb_pc_prd_qty.prd_grade_id
            AND tb_pl.shipment_status_id NOT IN ( 10, 11, 3 )
            AND tb_pl.doc_status = 1
          ) AS total_tot_actwgt`),
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
              AND UNIX_TIMESTAMP(CONCAT(tb_pl.ship_date, ' ', tb_pl.ship_time_begin)) >= UNIX_TIMESTAMP(CONCAT(tb_pl.ship_date, ' ', tb_pc_prd_qty.begin_time))
	            AND UNIX_TIMESTAMP(CONCAT(tb_pl.ship_date, ' ', tb_pl.ship_time_end)) <= UNIX_TIMESTAMP(CONCAT(tb_pl.ship_date, ' ', tb_pc_prd_qty.end_time))
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
                AND UNIX_TIMESTAMP(CONCAT(tb_pl.ship_date, ' ', tb_pl.ship_time_begin)) >= UNIX_TIMESTAMP(CONCAT(tb_pl.ship_date, ' ', tb_pc_prd_qty.begin_time))
	              AND UNIX_TIMESTAMP(CONCAT(tb_pl.ship_date, ' ', tb_pl.ship_time_end)) <= UNIX_TIMESTAMP(CONCAT(tb_pl.ship_date, ' ', tb_pc_prd_qty.end_time))
              ) AS total_tot_actwgt_2`),
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
                  AND UNIX_TIMESTAMP(CONCAT(tb_pl.ship_date, ' ', tb_pl.ship_time_begin)) >= UNIX_TIMESTAMP(CONCAT(tb_pl.ship_date, ' ', tb_pc_prd_qty.begin_time))
	                AND UNIX_TIMESTAMP(CONCAT(tb_pl.ship_date, ' ', tb_pl.ship_time_end)) <= UNIX_TIMESTAMP(CONCAT(tb_pl.ship_date, ' ', tb_pc_prd_qty.end_time))
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
                  AND UNIX_TIMESTAMP(CONCAT(tb_pl.ship_date, ' ', tb_pl.ship_time_begin)) >= UNIX_TIMESTAMP(CONCAT(tb_pl.ship_date, ' ', tb_pc_prd_qty.begin_time))
	                AND UNIX_TIMESTAMP(CONCAT(tb_pl.ship_date, ' ', tb_pl.ship_time_end)) <= UNIX_TIMESTAMP(CONCAT(tb_pl.ship_date, ' ', tb_pc_prd_qty.end_time))
                )) AS sum_tot_actwgt`),
        ])
        .from('tb_pc_plan')
        .leftJoin('tb_pc_plan_detail', 'tb_pc_plan.pc_plan_id', 'tb_pc_plan_detail.pc_plan_id')
        .leftJoin('tb_plant', 'tb_pc_plan_detail.plant_id', 'tb_plant.plant_id')
        .leftJoin('tb_pc_prd_qty', 'tb_pc_plan_detail.pc_plan_detail_id', 'tb_pc_prd_qty.pc_plan_detail_id')
        .leftJoin('tb_prd_grade', 'tb_pc_prd_qty.prd_grade_id', 'tb_prd_grade.prd_grade_id')
        .where({
          'tb_pc_plan.pc_date': shipdate,
          // 'tb_pc_plan_detail.plant_id': plantid,
          'tb_pc_prd_qty.prd_grade_id': prdgradeid,
        })
      // .having('sum_tot_actwgt', '<', this.db.raw('prd_grade_qty'))
    }
    // .whereIn('tb_pc_plan_detail.plant_id', plantids)
  }

  static getPcPlanList3(shipdate, prdgradeid, plantids = [], plId = null) {
    if (plId) {
      return this.db
        .select([
          'tb_pc_plan.pc_plan_id',
          'tb_pc_plan.pc_date',
          'tb_pc_plan_detail.plant_id',
          'tb_pc_prd_qty.pc_capacity',
          'tb_plant.plant_code',
          'tb_plant.plant_name',
          'tb_pc_prd_qty.prd_grade_qty',
          'tb_pc_prd_qty.begin_time',
          'tb_pc_prd_qty.end_time',
          'tb_prd_grade.prd_grade',
          this.db.raw(`(
      SELECT
        IFNULL( SUM( tb_pl_detail.tot_actwgt ), 0 )
      FROM
        tb_pl_detail
        INNER JOIN tb_pl ON tb_pl.pl_id = tb_pl_detail.pl_id
        LEFT JOIN tb_plant ON tb_pl.plant_id = tb_plant.plant_id
        LEFT JOIN tb_grade ON tb_pl_detail.com_grade_code = tb_grade.com_grade_code
        LEFT JOIN tb_prd_grade AS prd_grade ON tb_grade.prd_grade_id = prd_grade.prd_grade_id
      WHERE
        tb_pl.ship_date = tb_pc_plan.pc_date
        AND tb_plant.plant_id = tb_pc_plan_detail.plant_id
        AND prd_grade.prd_grade_id = tb_pc_prd_qty.prd_grade_id
        AND tb_pl.shipment_status_id NOT IN ( 10, 11, 3 )
        AND tb_pl.doc_status = 1
        AND tb_pl_detail.pl_id <> ?
      ) AS total_tot_actwgt`, [plId]),
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
          AND UNIX_TIMESTAMP(CONCAT(tb_pl.ship_date, ' ', tb_pl.ship_time_begin)) >= UNIX_TIMESTAMP(CONCAT(tb_pl.ship_date, ' ', tb_pc_prd_qty.begin_time))
          AND UNIX_TIMESTAMP(CONCAT(tb_pl.ship_date, ' ', tb_pl.ship_time_end)) <= UNIX_TIMESTAMP(CONCAT(tb_pl.ship_date, ' ', tb_pc_prd_qty.end_time))
          AND tb_pl_detail.pl_id <> ?
        ) AS total_tot_actwgt_1`, [plId]),
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
            AND UNIX_TIMESTAMP(CONCAT(tb_pl.ship_date, ' ', tb_pl.ship_time_begin)) >= UNIX_TIMESTAMP(CONCAT(tb_pl.ship_date, ' ', tb_pc_prd_qty.begin_time))
            AND UNIX_TIMESTAMP(CONCAT(tb_pl.ship_date, ' ', tb_pl.ship_time_end)) <= UNIX_TIMESTAMP(CONCAT(tb_pl.ship_date, ' ', tb_pc_prd_qty.end_time))
            AND tb_pl_detail.pl_id <> ?
          ) AS total_tot_actwgt_2`, [plId]),
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
              AND UNIX_TIMESTAMP(CONCAT(tb_pl.ship_date, ' ', tb_pl.ship_time_begin)) >= UNIX_TIMESTAMP(CONCAT(tb_pl.ship_date, ' ', tb_pc_prd_qty.begin_time))
              AND UNIX_TIMESTAMP(CONCAT(tb_pl.ship_date, ' ', tb_pl.ship_time_end)) <= UNIX_TIMESTAMP(CONCAT(tb_pl.ship_date, ' ', tb_pc_prd_qty.end_time))
              AND tb_pl_detail.pl_id <> ?
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
              AND UNIX_TIMESTAMP(CONCAT(tb_pl.ship_date, ' ', tb_pl.ship_time_begin)) >= UNIX_TIMESTAMP(CONCAT(tb_pl.ship_date, ' ', tb_pc_prd_qty.begin_time))
              AND UNIX_TIMESTAMP(CONCAT(tb_pl.ship_date, ' ', tb_pl.ship_time_end)) <= UNIX_TIMESTAMP(CONCAT(tb_pl.ship_date, ' ', tb_pc_prd_qty.end_time))
              AND tb_pl_detail.pl_id <> ?
            )) AS sum_tot_actwgt`, [plId, plId]),
        ])
        .from('tb_pc_plan')
        .leftJoin('tb_pc_plan_detail', 'tb_pc_plan.pc_plan_id', 'tb_pc_plan_detail.pc_plan_id')
        .leftJoin('tb_plant', 'tb_pc_plan_detail.plant_id', 'tb_plant.plant_id')
        .leftJoin('tb_pc_prd_qty', 'tb_pc_plan_detail.pc_plan_detail_id', 'tb_pc_prd_qty.pc_plan_detail_id')
        .leftJoin('tb_prd_grade', 'tb_pc_prd_qty.prd_grade_id', 'tb_prd_grade.prd_grade_id')
        .where({
          'tb_pc_plan.pc_date': shipdate,
          // 'tb_pc_plan_detail.plant_id': plantid,
          'tb_pc_prd_qty.prd_grade_id': prdgradeid,
        })
        .whereIn('tb_pc_plan_detail.plant_id', plantids)
    }
    return this.db
      .select([
        'tb_pc_plan.pc_plan_id',
        'tb_pc_plan.pc_date',
        'tb_pc_plan_detail.plant_id',
        'tb_pc_prd_qty.pc_capacity',
        'tb_plant.plant_code',
        'tb_plant.plant_name',
        'tb_pc_prd_qty.prd_grade_qty',
        'tb_pc_prd_qty.begin_time',
        'tb_pc_prd_qty.end_time',
        'tb_prd_grade.prd_grade',
        this.db.raw(`(
      SELECT
        IFNULL( SUM( tb_pl_detail.tot_actwgt ), 0 )
      FROM
        tb_pl_detail
        INNER JOIN tb_pl ON tb_pl.pl_id = tb_pl_detail.pl_id
        LEFT JOIN tb_plant ON tb_pl.plant_id = tb_plant.plant_id
        LEFT JOIN tb_grade ON tb_pl_detail.com_grade_code = tb_grade.com_grade_code
        LEFT JOIN tb_prd_grade AS prd_grade ON tb_grade.prd_grade_id = prd_grade.prd_grade_id
      WHERE
        tb_pl.ship_date = tb_pc_plan.pc_date
        AND tb_plant.plant_id = tb_pc_plan_detail.plant_id
        AND prd_grade.prd_grade_id = tb_pc_prd_qty.prd_grade_id
        AND tb_pl.shipment_status_id NOT IN ( 10, 11, 3 )
        AND tb_pl.doc_status = 1
      ) AS total_tot_actwgt`),
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
          AND UNIX_TIMESTAMP(CONCAT(tb_pl.ship_date, ' ', tb_pl.ship_time_begin)) >= UNIX_TIMESTAMP(CONCAT(tb_pl.ship_date, ' ', tb_pc_prd_qty.begin_time))
          AND UNIX_TIMESTAMP(CONCAT(tb_pl.ship_date, ' ', tb_pl.ship_time_end)) <= UNIX_TIMESTAMP(CONCAT(tb_pl.ship_date, ' ', tb_pc_prd_qty.end_time))
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
            AND UNIX_TIMESTAMP(CONCAT(tb_pl.ship_date, ' ', tb_pl.ship_time_begin)) >= UNIX_TIMESTAMP(CONCAT(tb_pl.ship_date, ' ', tb_pc_prd_qty.begin_time))
            AND UNIX_TIMESTAMP(CONCAT(tb_pl.ship_date, ' ', tb_pl.ship_time_end)) <= UNIX_TIMESTAMP(CONCAT(tb_pl.ship_date, ' ', tb_pc_prd_qty.end_time))
          ) AS total_tot_actwgt_2`),
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
              AND UNIX_TIMESTAMP(CONCAT(tb_pl.ship_date, ' ', tb_pl.ship_time_begin)) >= UNIX_TIMESTAMP(CONCAT(tb_pl.ship_date, ' ', tb_pc_prd_qty.begin_time))
              AND UNIX_TIMESTAMP(CONCAT(tb_pl.ship_date, ' ', tb_pl.ship_time_end)) <= UNIX_TIMESTAMP(CONCAT(tb_pl.ship_date, ' ', tb_pc_prd_qty.end_time))
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
              AND UNIX_TIMESTAMP(CONCAT(tb_pl.ship_date, ' ', tb_pl.ship_time_begin)) >= UNIX_TIMESTAMP(CONCAT(tb_pl.ship_date, ' ', tb_pc_prd_qty.begin_time))
              AND UNIX_TIMESTAMP(CONCAT(tb_pl.ship_date, ' ', tb_pl.ship_time_end)) <= UNIX_TIMESTAMP(CONCAT(tb_pl.ship_date, ' ', tb_pc_prd_qty.end_time))
            )) AS sum_tot_actwgt`),
      ])
      .from('tb_pc_plan')
      .leftJoin('tb_pc_plan_detail', 'tb_pc_plan.pc_plan_id', 'tb_pc_plan_detail.pc_plan_id')
      .leftJoin('tb_plant', 'tb_pc_plan_detail.plant_id', 'tb_plant.plant_id')
      .leftJoin('tb_pc_prd_qty', 'tb_pc_plan_detail.pc_plan_detail_id', 'tb_pc_prd_qty.pc_plan_detail_id')
      .leftJoin('tb_prd_grade', 'tb_pc_prd_qty.prd_grade_id', 'tb_prd_grade.prd_grade_id')
      .where({
        'tb_pc_plan.pc_date': shipdate,
        // 'tb_pc_plan_detail.plant_id': plantid,
        'tb_pc_prd_qty.prd_grade_id': prdgradeid,
      })
      .whereIn('tb_pc_plan_detail.plant_id', plantids)
  }

  static getSlotTimeAvailble(date, capRequired, plantId) {
    return db
      .select([
        'tb_time_slot.time_ids',
        db.raw(`TIME_FORMAT( tb_time_slot.time_begin, '%H:%i' ) AS time_begin`),
        db.raw(`TIME_FORMAT( tb_time_slot.time_end, '%H:%i' ) AS time_end`),
        db.raw(
          `CONCAT(TIME_FORMAT( tb_time_slot.time_begin, '%H:%i' ),'-',TIME_FORMAT( tb_time_slot.time_end, '%H:%i' )) AS slot_time`
        ),
        db.raw(`ifnull( fn_cap_sum ('${date}', tb_time_slot.time_begin, ${plantId} ), 0 ) AS cap_sum`),
        db.raw(`ifnull( fn_cap_booked ( '${date}', tb_time_slot.time_begin, ${plantId} ), 0 ) AS cap_booked`),
        //   db.raw(`ifnull((
        //   SELECT
        //     sum( tb_truck_type.stdtime_loding ) AS sum_loaddingtime
        //   FROM
        //     tb_pl
        //     INNER JOIN tb_truck_type ON tb_truck_type.truck_type_id = tb_pl.truck_type_id
        //   WHERE
        //     tb_pl.ship_date = '${date}'
        //     AND tb_pl.ship_time_begin = tb_time_slot.time_begin
        //     ),
        //   0
        // ) AS cap_booked`),
        // db.raw(`(
        // ifnull( fn_cap_sum ( '${date}', tb_time_slot.time_begin, ${plantId} ), 0 )) -(
        // ifnull((
        //   SELECT
        //     sum( tb_truck_type.stdtime_loding ) AS sum_loaddingtime
        //   FROM
        //     tb_pl
        //     INNER JOIN tb_truck_type ON tb_truck_type.truck_type_id = tb_pl.truck_type_id
        //   WHERE
        //     tb_pl.ship_date = '${date}'
        //     AND tb_pl.ship_time_begin = tb_time_slot.time_begin
        //     ),
        //   0
        // )) AS cap_diff`),
        db.raw(
          `ifnull( fn_cap_sum ( '${date}', tb_time_slot.time_begin, ${plantId} ), 0 ) - ifnull( fn_cap_booked ( '${date}', tb_time_slot.time_begin, ${plantId} ), 0 ) AS cap_diff`
        ),
        db.raw(`IF(
          ifnull( fn_cap_sum ( '${date}', tb_time_slot.time_begin, ${plantId} ), 0 ) - ( ifnull( fn_cap_booked ( '${date}', tb_time_slot.time_begin, ${plantId} ), 0 ) ) > 0,
          'Y',
          'N'
        ) AS cap_avalible`),
        // db.raw(`IF
        // (((
        //       ifnull( fn_cap_sum ( '${date}', tb_time_slot.time_begin, ${plantId} ), 0 )
        //       )-((
        //         ifnull((
        //           SELECT
        //             sum( tb_truck_type.stdtime_loding ) AS sum_loaddingtime
        //           FROM
        //             tb_pl
        //             INNER JOIN tb_truck_type ON tb_truck_type.truck_type_id = tb_pl.truck_type_id
        //           WHERE
        //             tb_pl.ship_date = '${date}'
        //             AND tb_pl.ship_time_begin = tb_time_slot.time_begin
        //             ),
        //           0
        //         ))+ ${capRequired}
        //       ))< 0,
        //   'N',
        //   'Y'
        // ) AS cap_avalible`),
      ])
      .from('tb_time_slot')
      .whereBetween('tb_time_slot.time_begin', ['00:00:00', '23:59:59'])
  }

  static getSlotTimeAvailble2(shipDate, plantId, pcCapacity, beginTime, endTime) {
    return this.db
      .select([
        'tb_time_slot.*',
        db.raw(`(
          SELECT
            IFNULL(SUM(tb_truck_type.stdtime_loding), 0)
          FROM
            tb_pl
            JOIN tb_truck_type ON tb_pl.truck_type_id = tb_truck_type.truck_type_id
          WHERE
            tb_pl.ship_date = ?
            AND tb_pl.plant_id = ?
            AND tb_pl.shipment_status_id NOT IN(10, 11, 3)
            AND UNIX_TIMESTAMP(CONCAT(tb_pl.ship_date, ' ', tb_pl.ship_time_begin)) >= UNIX_TIMESTAMP(CONCAT(tb_pl.ship_date, ' ', tb_time_slot.time_begin))
            AND UNIX_TIMESTAMP(CONCAT(tb_pl.ship_date, ' ', tb_pl.ship_time_end)) <= UNIX_TIMESTAMP(CONCAT(tb_pl.ship_date, ' ', tb_time_slot.time_end))) AS sum_booking_min`, [shipDate, plantId]),
        db.raw(`(? * 60) AS p_cap`, [pcCapacity]),
        db.raw(`((? * 60) - (
          SELECT
            IFNULL(SUM(tb_truck_type.stdtime_loding), 0)
          FROM
            tb_pl
            JOIN tb_truck_type ON tb_pl.truck_type_id = tb_truck_type.truck_type_id
          WHERE
            tb_pl.ship_date = ?
            AND tb_pl.plant_id = ?
            AND tb_pl.shipment_status_id NOT IN(10, 11, 3)
            AND UNIX_TIMESTAMP(CONCAT(tb_pl.ship_date, ' ', tb_pl.ship_time_begin)) >= UNIX_TIMESTAMP(CONCAT(tb_pl.ship_date, ' ', tb_time_slot.time_begin))
            AND UNIX_TIMESTAMP(CONCAT(tb_pl.ship_date, ' ', tb_pl.ship_time_end)) <= UNIX_TIMESTAMP(CONCAT(tb_pl.ship_date, ' ', tb_time_slot.time_end)))) AS cab_balance`, [pcCapacity, shipDate, plantId]),
        db.raw(`if((? * 60) - (
            SELECT
              IFNULL(SUM(tb_truck_type.stdtime_loding), 0)
            FROM
              tb_pl
              JOIN tb_truck_type ON tb_pl.truck_type_id = tb_truck_type.truck_type_id
            WHERE
              tb_pl.ship_date = ?
              AND tb_pl.plant_id = ?
              AND tb_pl.shipment_status_id NOT IN(10, 11, 3)
              AND UNIX_TIMESTAMP(CONCAT(tb_pl.ship_date, ' ', tb_pl.ship_time_begin)) >= UNIX_TIMESTAMP(CONCAT(tb_pl.ship_date, ' ', tb_time_slot.time_begin))
              AND UNIX_TIMESTAMP(CONCAT(tb_pl.ship_date, ' ', tb_pl.ship_time_end)) <= UNIX_TIMESTAMP(CONCAT(tb_pl.ship_date, ' ', tb_time_slot.time_end))) > 0, 'Y', 'N')	AS cab_flag`, [pcCapacity, shipDate, plantId])
      ])
      .from('tb_time_slot')
      .whereRaw(`UNIX_TIMESTAMP(CONCAT(?, ' ', tb_time_slot.time_begin)) >= UNIX_TIMESTAMP(CONCAT(?, ' ', ?))`, [shipDate, shipDate, beginTime])
      .whereRaw(`UNIX_TIMESTAMP(CONCAT(?, ' ', tb_time_slot.time_end)) <= UNIX_TIMESTAMP(CONCAT(?, ' ', ?))`, [shipDate, shipDate, endTime])
  }

  static getSlotTimeList() {
    return this.db.select('tb_time_slot.*').from('tb_time_slot')
  }
}

Model.tableName = TB_PL
Model.db = db

module.exports = Model