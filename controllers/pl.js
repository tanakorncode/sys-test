const _ = require("lodash")
const TbPL = require("../models/mysql/pl")
const TbTruckType = require("../models/mysql/truck_type")
const TbTruckTypePlant = require("../models/mysql/truck_type_plant")
const TbGrade = require("../models/mysql/grade")
const TbPrdGrade = require("../models/mysql/prd_grade")
const TbPCPlan = require("../models/mysql/pc_plan")
const TbPLDetail = require("../models/mysql/pl_detail")
const db = require("../core/config/mysql")
const assert = require("http-assert")
const chalk = require("chalk")
const moment = require("moment")
moment.locale("th")

exports.postCheckPlan = async (req, res) => {
  try {
    const body = req.body
    const headerComGradeCode = _.get(body, "h_com_grade_code") // เกรดหัว
    const footerComGradeCode = _.get(body, "f_com_grade_code") // เกรดหาง

    const plId = _.get(body, "pl_id", null)
    const isNewRecord = plId === null || plId === "" || plId === undefined || plId === "undefined"

    let pl = null

    // ถ้าไม่ใช่การสร้างรายการใหม่
    if (!isNewRecord) {
      pl = await TbPL.findOneById(plId)
    }

    const times = await TbPL.getSlotTimeList()

    const formHeader = _.get(req.body.form, "header") // ข้อมูลส่วนหัว
    const formFooter = _.get(req.body.form, "footer") // ข้อมูลส่วนหาง

    let isSameGrade = false // เกรดเดียว
    // ถ้ามีเกรดหัวและหาง
    if (headerComGradeCode && footerComGradeCode) {
      isSameGrade = headerComGradeCode === footerComGradeCode // ตรวจสอบว่าเป็นเกรดเดียวกันหรือไม่
    } else {
      isSameGrade = true
    }

    // ประเภทรถ
    const trucktype = await TbTruckType.findOneById(req.body.truck_type_id)
    assert(trucktype, 404, "trucktype not found.")

    // โรงงานที่อนุญาติ
    const trucktypeplants = await TbTruckTypePlant.getItems({
      "tb_truck_type_plant.truck_type_id": req.body.truck_type_id,
    })
    let truckplantids = trucktypeplants.map((item) => parseInt(item.plant_id)) // รหัสโรงงานที่อนุญาติ
    assert(truckplantids.length > 0, 422, `ประเภทรถที่เลือกยังไม่ได้ถูกกำหนดสถานที่จัดส่ง.`)

    // เกรดส่วนหัว
    let hgrade = null
    let hprdgrade = null
    if (headerComGradeCode) {
      hgrade = await TbGrade.findOne({ com_grade_code: headerComGradeCode })
      assert(hgrade, 404, `ไม่พบข้อมูลเกรด '${headerComGradeCode}' ในระบบ.`)
      if (hgrade) {
        hprdgrade = await TbPrdGrade.findOneById(_.get(hgrade, "prd_grade_id", ""))
        assert(hprdgrade, 404, `เกรด ${headerComGradeCode} ไม่ได้ระบุกลุ่มเกรด.`)
      }
    }

    // เกรดส่วนหาง
    let fgrade = null
    let fprdgrade = null
    if (footerComGradeCode) {
      fgrade = await TbGrade.findOne({ com_grade_code: footerComGradeCode })
      assert(fgrade, 404, `ไม่พบข้อมูลเกรด '${footerComGradeCode}' ในระบบ.`)
      if (fgrade) {
        fprdgrade = await TbPrdGrade.findOneById(_.get(fgrade, "prd_grade_id", ""))
        assert(fprdgrade, 404, `เกรด ${footerComGradeCode} ไม่ได้ระบุกลุ่มเกรด.`)
      }
    }

    // หารายการกำหนดโรงงาน
    const fixplant = await TbPCPlan.getRetFixplant(req.body.ret_id).first()
    console.log('fixplant', fixplant);

    let steps = []
    let pcplans = []
    let pcplan = null
    let plantIdSelected = null
    // รายการล่าสุด
    let lastpl = null

    //ถ้ามีการกำหนดโรงงาน
    if (fixplant) {
      if (!truckplantids.includes(fixplant.plant_id)) {
        assert(false, 422, `โรงงานที่ถูกกำหนด ไม่ได้อยู่รายชื่อโรงงานที่ได้รับอนุญาตตามประเภทรถที่เลือก.`)
      }
      steps.push({ step: 1, description: "มีการกำหนดโรงงาน" })
      // ถ้าเป็นเกรดเดียว
      if (isSameGrade) {
        steps.push({ step: 2, description: "เป็นเกรดเดียว" })

        let pcplans = []
        // id โรงงาน
        let plantids = []
        plantids.push(fixplant.plant_id)
        const prdGradeId = _.get(hprdgrade, "prd_grade_id") // รหัสกลุ่มเกรด
        let plans = await TbPL.getPcPlanList3(req.body.ship_date, prdGradeId, plantids, plId)
        plans = _.orderBy(plans, ["plant_id", "prd_grade_qty"], ["asc", "desc"])
        steps.push({
          step: 3,
          description: "ค้นหารายการแผน",
          params: { ship_date: req.body.ship_date, prdGradeId: prdGradeId, plantids: plantids, plId: plId },
          plans: plans,
        })

        plans = _.filter(plans, (pcplan) => checkPcPlanBalance(pcplan))
        pcplans = await getSlottimeToPcPlan(pcplans, plans, req.body.ship_date, hprdgrade)

        // for (let i = 0; i < plans.length; i++) {
        //   const plan = plans[i]
        //   let slottimes = await TbPL.getSlotTimeAvailble2(
        //     req.body.ship_date,
        //     plan.plant_id,
        //     plan.pc_capacity,
        //     plan.begin_time,
        //     plan.end_time
        //   )
        //   slottimes = _.map(slottimes, (item) => {
        //     let disabled = false
        //     if (_.get(hprdgrade, "begin_time", null) && _.get(hprdgrade, "end_time", null)) {
        //       const gstunix = convertUnnixtime(`${req.body.ship_date} ${hprdgrade.begin_time}`)
        //       const gedunix = convertUnnixtime(`${req.body.ship_date} ${hprdgrade.end_time}`)

        //       if (
        //         convertUnnixtime(`${req.body.ship_date} ${item.time_begin}`) < gstunix ||
        //         convertUnnixtime(`${req.body.ship_date} ${item.time_end}`) > gedunix
        //       ) {
        //         disabled = true
        //       }
        //     }
        //     return updateObject(item, {
        //       disabled: disabled || item.cab_flag === "N" ? true : false,
        //     })
        //   })
        //   const itemlen = _.filter(slottimes, (item) => item.cab_flag === "Y" && !item.disabled).length
        //   steps.push({
        //     step: 4,
        //     description: "หาช่วงเวลา",
        //     params: {
        //       ship_date: req.body.ship_date,
        //       plant_id: plan.plant_id,
        //       pc_capacity: plan.pc_capacity,
        //       begin_time: plan.begin_time,
        //       end_time: plan.end_time,
        //     },
        //     slottimes: slottimes,
        //   })
        //   if (itemlen > 0) {
        //     pcplans.push(updateObject(plan, { slottimes: slottimes }))
        //   }
        // }
        steps.push({
          step: 5,
          description: "หารายการแผนที่สามารถกำหนดโรงงานได้ ซึ่งยอดจองต้องน้อยกว่ายอดแผน",
          // params: { truckplantids: truckplantids },
          pcplans: pcplans,
        })
        return res.send(_.get(pcplans, "[0]"))
      }
      // คนละเกรด
      else {
        steps.push({ step: 2, description: "เป็นคนละเกรด" })

        // id โรงงาน
        let plantids = []
        plantids.push(fixplant.plant_id)

        const headerPrdGradeId = _.get(hprdgrade, "prd_grade_id") // รหัสกลุ่มเกรด
        let hpcplans = await TbPL.getPcPlanList3(req.body.ship_date, headerPrdGradeId, plantids, plId)
        hpcplans = _.orderBy(hpcplans, ["plant_id", "prd_grade_qty"], ["asc", "desc"])

        hpcplans = _.filter(hpcplans, (pcplan) => checkPcPlanBalance(pcplan))

        let headerPcPlans = []
        headerPcPlans = await getSlottimeToPcPlan(headerPcPlans, hpcplans, req.body.ship_date, hprdgrade)
        // for (let i = 0; i < hpcplans.length; i++) {
        //   const plan = hpcplans[i]
        //   let slottimes = await TbPL.getSlotTimeAvailble2(
        //     req.body.ship_date,
        //     plan.plant_id,
        //     plan.pc_capacity,
        //     plan.begin_time,
        //     plan.end_time
        //   )
        //   slottimes = _.map(slottimes, (item) => {
        //     let disabled = false
        //     if (_.get(hprdgrade, "begin_time", null) && _.get(hprdgrade, "end_time", null)) {
        //       const gstunix = convertUnnixtime(`${req.body.ship_date} ${hprdgrade.begin_time}`)
        //       const gedunix = convertUnnixtime(`${req.body.ship_date} ${hprdgrade.end_time}`)

        //       if (
        //         convertUnnixtime(`${req.body.ship_date} ${item.time_begin}`) < gstunix ||
        //         convertUnnixtime(`${req.body.ship_date} ${item.time_end}`) > gedunix
        //       ) {
        //         disabled = true
        //       }
        //     }
        //     return updateObject(item, {
        //       disabled: disabled || item.cab_flag === "N" ? true : false,
        //     })
        //   })
        //   const itemlen = _.filter(slottimes, (item) => item.cab_flag === "Y" && !item.disabled).length
        //   steps.push({
        //     step: 4,
        //     description: "หาช่วงเวลา",
        //     params: {
        //       ship_date: req.body.ship_date,
        //       plant_id: plan.plant_id,
        //       pc_capacity: plan.pc_capacity,
        //       begin_time: plan.begin_time,
        //       end_time: plan.end_time,
        //     },
        //     slottimes: slottimes,
        //   })
        //   if (itemlen > 0) {
        //     headerPcPlans.push(updateObject(plan, { slottimes: slottimes }))
        //   }
        // }

        const footerPrdGradeId = _.get(fprdgrade, "prd_grade_id") // รหัสกลุ่มเกรด
        let fpcplans = await TbPL.getPcPlanList3(req.body.ship_date, footerPrdGradeId, plantids, plId)
        fpcplans = _.orderBy(fpcplans, ["plant_id", "prd_grade_qty"], ["asc", "desc"])

        fpcplans = _.filter(fpcplans, (pcplan) => checkPcPlanBalance(pcplan))

        let footerPcPlans = []
        footerPcPlans = await getSlottimeToPcPlan(footerPcPlans, fpcplans, req.body.ship_date, fprdgrade)
        // for (let i = 0; i < fpcplans.length; i++) {
        //   const plan = fpcplans[i]
        //   let slottimes = await TbPL.getSlotTimeAvailble2(
        //     req.body.ship_date,
        //     plan.plant_id,
        //     plan.pc_capacity,
        //     plan.begin_time,
        //     plan.end_time
        //   )
        //   slottimes = _.map(slottimes, (item) => {
        //     let disabled = false
        //     if (_.get(fprdgrade, "begin_time", null) && _.get(fprdgrade, "end_time", null)) {
        //       const gstunix = convertUnnixtime(`${req.body.ship_date} ${fprdgrade.begin_time}`)
        //       const gedunix = convertUnnixtime(`${req.body.ship_date} ${fprdgrade.end_time}`)

        //       if (
        //         convertUnnixtime(`${req.body.ship_date} ${item.time_begin}`) < gstunix ||
        //         convertUnnixtime(`${req.body.ship_date} ${item.time_end}`) > gedunix
        //       ) {
        //         disabled = true
        //       }
        //     }
        //     return updateObject(item, {
        //       disabled: disabled || item.cab_flag === "N" ? true : false,
        //     })
        //   })
        //   const itemlen = _.filter(slottimes, (item) => item.cab_flag === "Y" && !item.disabled).length
        //   steps.push({
        //     step: 4,
        //     description: "หาช่วงเวลา",
        //     params: {
        //       ship_date: req.body.ship_date,
        //       plant_id: plan.plant_id,
        //       pc_capacity: plan.pc_capacity,
        //       begin_time: plan.begin_time,
        //       end_time: plan.end_time,
        //     },
        //     slottimes: slottimes,
        //   })
        //   if (itemlen > 0) {
        //     footerPcPlans.push(updateObject(plan, { slottimes: slottimes }))
        //   }
        // }

        // ถ้ามีแผนทั้งหัวและหาง
        if (headerPcPlans.length && footerPcPlans.length) {
          const mapFooterPcPlans = []

          for (let i = 0; i < headerPcPlans.length; i++) {
            const headerPcPlan = headerPcPlans[i]
            const slottimes = _.get(headerPcPlan, "slottimes", []) // ช่วงเวลาส่วนหัว
            const timebegins = _.map(slottimes, (item) => item.time_begin)
            // หารายการแผนของส่วนหาง ที่มีช่วงเวลาตรงกันกับส่วนหัว
            for (let i = 0; i < footerPcPlans.length; i++) {
              const footerPcPlan = footerPcPlans[i]
              const slottimes = _.filter(_.get(footerPcPlan, "slottimes", []), (item) =>
                timebegins.includes(item.time_begin)
              )
              if (slottimes.length) {
                mapFooterPcPlans.push(updateObject(footerPcPlan, { slottimes: slottimes }))
                break;
              }
            }
          }
          footerPcPlans = mapFooterPcPlans
          const headerPlantId = _.get(headerPcPlans, '[0].plant_id', null)
          const footerPlantId = _.get(footerPcPlans, '[0].plant_id', null)
          if (headerPlantId && footerPlantId) {
            let slottimes = _.get(_.get(headerPcPlans, '[0]'), "slottimes", []) // ช่วงเวลาส่วนหัว
            const timebegins = _.map(slottimes, (item) => item.time_begin)
            slottimes = _.filter(_.get(_.get(footerPcPlans, '[0]'), "slottimes", []), (item) =>
              timebegins.includes(item.time_begin)
            )
            return res.send(updateObject(_.get(headerPcPlans, '[0]'), { slottimes: slottimes }))
          }
        }
        return res.send(null)
      }
    } else {
      // ถ้าเป็นเกรดเดียว
      if (isSameGrade) {
        const prdGradeId = _.get(hprdgrade, "prd_grade_id") // รหัสกลุ่มเกรด
        let plans = await TbPL.getPcPlanList3(req.body.ship_date, prdGradeId, truckplantids, plId)
        plans = _.orderBy(plans, ["plant_id", "prd_grade_qty"], ["asc", "desc"])

        plans = _.filter(plans, (pcplan) => checkPcPlanBalance(pcplan))
        pcplans = await getSlottimeToPcPlan(pcplans, plans, req.body.ship_date, hprdgrade)
        pcplans = _.uniqBy(pcplans, 'plant_id')

        // ถ้ามีมากกว่า 1 โรง ให้สลับกับโรงก่อนหน้า
        if (pcplans.length > 1) {
          lastpl = await TbPL.find()
            .innerJoin("tb_pl_detail", "tb_pl.pl_id", "tb_pl_detail.pl_id")
            .where({ "tb_pl.ship_date": req.body.ship_date, "tb_pl_detail.com_grade_code": headerComGradeCode })
            .whereRaw("tb_pl.shipment_status_id <> ?", [11])
            .whereRaw("tb_pl.doc_status <> ?", [2])
            .orderBy("tb_pl.pl_id", "desc")
            .first()

          if (lastpl) {
            // ตัดโรงที่ตรงกับโรงก่อนหน้า
            const items = _.filter(pcplans, (item) => item.plant_id !== lastpl.plant_id)
            // ถ้ามี
            if (items.length) {
              const pcplan = _.get(items, '[0]')
              let slottimes = _.get(pcplan, 'slottimes', [])
              slottimes = mapSlotTimes(slottimes, times)
              return res.send(updateObject(pcplan, { slottimes: slottimes }))
            } else {
              const pcplan = _.get(pcplans, '[0]')
              if (pcplan) {
                let slottimes = _.get(pcplan, 'slottimes', [])
                slottimes = mapSlotTimes(slottimes, times)
                return res.send(updateObject(pcplan, { slottimes: slottimes }))
              }
              return res.send(pcplan)
            }
          } else {
            const pcplan = _.get(pcplans, '[0]')
            if (pcplan) {
              let slottimes = _.get(pcplan, 'slottimes', [])
              slottimes = mapSlotTimes(slottimes, times)
              return res.send(updateObject(pcplan, { slottimes: slottimes }))
            }
            return res.send(pcplan)
          }
        }
        const pcplan = _.get(pcplans, '[0]')
        if (pcplan) {
          let slottimes = _.get(pcplan, 'slottimes', [])
          slottimes = mapSlotTimes(slottimes, times)
          return res.send(updateObject(pcplan, { slottimes: slottimes }))
        }
        return res.send(pcplan)
      } else {
        // ถ้าเป็น 2 เกรด

        // ส่วนหัว
        const headerPrdGradeId = _.get(hprdgrade, "prd_grade_id") // รหัสกลุ่มเกรด
        let hpcplans = await TbPL.getPcPlanList3(req.body.ship_date, headerPrdGradeId, truckplantids, plId)
        hpcplans = _.orderBy(hpcplans, ["plant_id", "prd_grade_qty"], ["asc", "desc"])

        hpcplans = _.filter(hpcplans, (pcplan) => checkPcPlanBalance(pcplan))

        let headerPcPlans = []
        headerPcPlans = await getSlottimeToPcPlan(headerPcPlans, hpcplans, req.body.ship_date, hprdgrade)
        // for (let i = 0; i < hpcplans.length; i++) {
        //   const plan = hpcplans[i]
        //   let slottimes = await TbPL.getSlotTimeAvailble2(
        //     req.body.ship_date,
        //     plan.plant_id,
        //     plan.pc_capacity,
        //     plan.begin_time,
        //     plan.end_time
        //   )
        //   slottimes = _.map(slottimes, (item) => {
        //     let disabled = false
        //     if (_.get(hprdgrade, "begin_time", null) && _.get(hprdgrade, "end_time", null)) {
        //       const gstunix = convertUnnixtime(`${req.body.ship_date} ${hprdgrade.begin_time}`)
        //       const gedunix = convertUnnixtime(`${req.body.ship_date} ${hprdgrade.end_time}`)

        //       if (
        //         convertUnnixtime(`${req.body.ship_date} ${item.time_begin}`) < gstunix ||
        //         convertUnnixtime(`${req.body.ship_date} ${item.time_end}`) > gedunix
        //       ) {
        //         disabled = true
        //       }
        //     }
        //     return updateObject(item, {
        //       disabled: disabled || item.cab_flag === "N" ? true : false,
        //     })
        //   })
        //   const itemlen = _.filter(slottimes, (item) => item.cab_flag === "Y" && !item.disabled).length
        //   if (itemlen > 0) {
        //     headerPcPlans.push(updateObject(plan, { slottimes: slottimes }))
        //   }
        // }
        // headerPcPlans = _.uniqBy(headerPcPlans, 'plant_id')

        // ส่วนหาง
        const hplantIds = _.map(headerPcPlans, (item) => item.plant_id)
        const footerPrdGradeId = _.get(fprdgrade, "prd_grade_id") // รหัสกลุ่มเกรด
        let fpcplans = await TbPL.getPcPlanList3(req.body.ship_date, footerPrdGradeId, hplantIds, plId)
        fpcplans = _.orderBy(fpcplans, ["plant_id", "prd_grade_qty"], ["asc", "desc"])

        fpcplans = _.filter(fpcplans, (pcplan) => checkPcPlanBalance(pcplan))

        let footerPcPlans = []
        footerPcPlans = await getSlottimeToPcPlan(footerPcPlans, fpcplans, req.body.ship_date, fprdgrade)

        let mapHeaderPcPlans = []
        for (let i = 0; i < headerPcPlans.length; i++) {
          const headerPcPlan = headerPcPlans[i];
          const slottimes = _.get(headerPcPlan, "slottimes", []) // ช่วงเวลาส่วนหัว
          const timebegins = _.map(slottimes, (item) => item.time_begin)

          const pcplans = _.filter(footerPcPlans, (item) => {
            const isMatchplant = item.plant_id === headerPcPlan.plant_id
            const slottimes = _.filter(_.get(item, "slottimes", []), (item) =>
              timebegins.includes(item.time_begin)
            )
            return isMatchplant && slottimes.length
          })
            .map((item) => {
              const slottimes = _.filter(_.get(item, "slottimes", []), (item) =>
                timebegins.includes(item.time_begin)
              )
              return updateObject(item, { slottimes: slottimes })
            })
          if (pcplans.length) {
            mapHeaderPcPlans.push(updateObject(headerPcPlan, {
              footerPcPlans: pcplans
            }))
          }
        }

        // ถ้ามีมากกว่า 1 โรง ให้สลับกับโรงก่อนหน้า
        let oldHeaderPcPlans = headerPcPlans
        if (mapHeaderPcPlans.length) {
          const lastpl = await TbPL.find()
            .innerJoin("tb_pl_detail", "tb_pl.pl_id", "tb_pl_detail.pl_id")
            .where({ "tb_pl.ship_date": req.body.ship_date, "tb_pl_detail.com_grade_code": headerComGradeCode })
            .whereRaw("tb_pl.shipment_status_id <> ?", [11])
            .whereRaw("tb_pl.doc_status <> ?", [2])
            .orderBy("tb_pl.pl_id", "desc")
            .first()

          if (lastpl) {
            // ตัดโรงที่ตรงกับโรงก่อนหน้า
            const items = _.filter(mapHeaderPcPlans, (item) => item.plant_id !== lastpl.plant_id)
            // ถ้ามี
            if (items.length) {
              mapHeaderPcPlans = items
            } else {
              const items = _.filter(mapHeaderPcPlans, (item) => item.plant_id === lastpl.plant_id)
              if (items.length) {
                mapHeaderPcPlans = items
              }
            }
          }
        }

        mapHeaderPcPlans = _.orderBy(mapHeaderPcPlans, ["sum_tot_actwgt", "begin_time"], ["desc", "asc"])
        if (mapHeaderPcPlans.length) {
          const headerPcPlan = _.get(mapHeaderPcPlans, '[0]')
          let slottimes = _.get(headerPcPlan, "slottimes", []) // ช่วงเวลาส่วนหัว
          slottimes = mapSlotTimes(slottimes, times)
          return res.send(updateObject(headerPcPlan, { slottimes: slottimes }))
        }
        return res.send(null)

        if (headerPcPlans.length && footerPcPlans.length) {
          const mapFooterPcPlans = []

          for (let i = 0; i < headerPcPlans.length; i++) {
            const headerPcPlan = headerPcPlans[i]
            const slottimes = _.get(headerPcPlan, "slottimes", []) // ช่วงเวลาส่วนหัว
            const timebegins = _.map(slottimes, (item) => item.time_begin)
            // หารายการแผนของส่วนหาง ที่มีช่วงเวลาตรงกันกับส่วนหัว
            for (let i = 0; i < footerPcPlans.length; i++) {
              const footerPcPlan = footerPcPlans[i]
              const slottimes = _.filter(_.get(footerPcPlan, "slottimes", []), (item) =>
                timebegins.includes(item.time_begin)
              )
              if (slottimes.length) {
                mapFooterPcPlans.push(updateObject(footerPcPlan, { slottimes: slottimes, headerPcPlan: headerPcPlan }))
                break;
              }
            }
          }
          footerPcPlans = mapFooterPcPlans
          return res.send(footerPcPlans)
          // const headerPcPlan = _.get(footerPcPlans, '[0].headerPcPlan', null)
          // const footerPcPlan = _.get(footerPcPlans, '[0]', null)
          // const headerPlantId = _.get(headerPcPlan, 'plant_id', null)
          // const footerPlantId = _.get(footerPcPlan, 'plant_id', null)
          // if (headerPlantId && footerPlantId && headerPlantId === footerPlantId) {
          //   let slottimes = _.get(headerPcPlan, ".slottimes", []) // ช่วงเวลาส่วนหัว
          //   const timebegins = _.map(slottimes, (item) => item.time_begin)
          //   slottimes = _.filter(_.get(footerPcPlan, "slottimes", []), (item) =>
          //     timebegins.includes(item.time_begin)
          //   )
          //   if (slottimes.length) {
          //     return res.send(updateObject(headerPcPlan, { slottimes: slottimes }))
          //   }
          // }
        }

        return res.send({ headerPcPlans, footerPcPlans })
        // for (let i = 0; i < fpcplans.length; i++) {
        //   const plan = fpcplans[i]
        //   let slottimes = await TbPL.getSlotTimeAvailble2(
        //     req.body.ship_date,
        //     plan.plant_id,
        //     plan.pc_capacity,
        //     plan.begin_time,
        //     plan.end_time
        //   )
        //   slottimes = _.map(slottimes, (item) => {
        //     let disabled = false
        //     if (_.get(fprdgrade, "begin_time", null) && _.get(fprdgrade, "end_time", null)) {
        //       const gstunix = convertUnnixtime(`${req.body.ship_date} ${fprdgrade.begin_time}`)
        //       const gedunix = convertUnnixtime(`${req.body.ship_date} ${fprdgrade.end_time}`)

        //       if (
        //         convertUnnixtime(`${req.body.ship_date} ${item.time_begin}`) < gstunix ||
        //         convertUnnixtime(`${req.body.ship_date} ${item.time_end}`) > gedunix
        //       ) {
        //         disabled = true
        //       }
        //     }
        //     return updateObject(item, {
        //       disabled: disabled || item.cab_flag === "N" ? true : false,
        //     })
        //   })
        //   const itemlen = _.filter(slottimes, (item) => item.cab_flag === "Y" && !item.disabled).length
        //   if (itemlen > 0) {
        //     footerPcPlans.push(updateObject(plan, { slottimes: slottimes }))
        //   }
        // }
        // footerPcPlans = _.uniqBy(footerPcPlans, 'plant_id')

        // ถ้ามีมากกว่า 1 โรง ให้สลับกับโรงก่อนหน้า
        if (footerPcPlans.length) {
          const lastpl = await TbPL.find()
            .innerJoin("tb_pl_detail", "tb_pl.pl_id", "tb_pl_detail.pl_id")
            .where({ "tb_pl.ship_date": req.body.ship_date, "tb_pl_detail.com_grade_code": footerComGradeCode })
            .whereRaw("tb_pl.shipment_status_id <> ?", [11])
            .whereRaw("tb_pl.doc_status <> ?", [2])
            .orderBy("tb_pl.pl_id", "desc")
            .first()

          if (lastpl) {
            // ตัดโรงที่ตรงกับโรงก่อนหน้า
            const items = _.filter(footerPcPlans, (item) => item.plant_id !== lastpl.plant_id)
            // ถ้ามี
            if (items.length) {
              footerPcPlans = items
            }
          }
        }

        // const plantIds = _.map(footerPcPlans, (item) => item.plant_id)
        // headerPcPlans = _.filter(headerPcPlans, (item) => plantIds.includes(item.plant_id))

        // ถ้ามีแผนทั้งหัวและหาง
        if (headerPcPlans.length && footerPcPlans.length) {
          const mapFooterPcPlans = []

          for (let i = 0; i < headerPcPlans.length; i++) {
            const headerPcPlan = headerPcPlans[i]
            const slottimes = _.get(headerPcPlan, "slottimes", []) // ช่วงเวลาส่วนหัว
            const timebegins = _.map(slottimes, (item) => item.time_begin)
            // หารายการแผนของส่วนหาง ที่มีช่วงเวลาตรงกันกับส่วนหัว
            for (let i = 0; i < footerPcPlans.length; i++) {
              const footerPcPlan = footerPcPlans[i]
              const slottimes = _.filter(_.get(footerPcPlan, "slottimes", []), (item) =>
                timebegins.includes(item.time_begin)
              )
              if (slottimes.length) {
                mapFooterPcPlans.push(updateObject(footerPcPlan, { slottimes: slottimes }))
                break;
              }
            }
          }
          footerPcPlans = mapFooterPcPlans
          const headerPlantId = _.get(headerPcPlans, '[0].plant_id', null)
          const footerPlantId = _.get(footerPcPlans, '[0].plant_id', null)
          if (headerPlantId && footerPlantId && headerPlantId === footerPlantId) {
            let slottimes = _.get(_.get(headerPcPlans, '[0]'), "slottimes", []) // ช่วงเวลาส่วนหัว
            const timebegins = _.map(slottimes, (item) => item.time_begin)
            slottimes = _.filter(_.get(_.get(footerPcPlans, '[0]'), "slottimes", []), (item) =>
              timebegins.includes(item.time_begin)
            )
            return res.send(updateObject(_.get(headerPcPlans, '[0]'), { slottimes: slottimes }))
          }
        }
        return res.send(null)
      }
    }
    // รายการแรกของวัน
    const firstpl = await TbPL.find()
      .where({ ship_date: req.body.ship_date })
      .whereRaw("tb_pl.shipment_status_id <> ?", [11])
      .whereRaw("tb_pl.doc_status <> ?", [2])
      .first()


    if (!isNewRecord) {
      if (isSameGrade) {
        lastpl = await TbPL.find()
          .innerJoin("tb_pl_detail", "tb_pl.pl_id", "tb_pl_detail.pl_id")
          .where({ "tb_pl.ship_date": req.body.ship_date, "tb_pl_detail.com_grade_code": headerComGradeCode })
          .whereRaw("tb_pl.pl_id <> ?", [plId])
          .whereRaw("tb_pl.shipment_status_id <> ?", [11])
          .whereRaw("tb_pl.doc_status <> ?", [2])
          .orderBy("tb_pl.pl_id", "desc")
          .first()
      } else {
        lastpl = await TbPL.find()
          .innerJoin("tb_pl_detail", "tb_pl.pl_id", "tb_pl_detail.pl_id")
          .where({ "tb_pl.ship_date": req.body.ship_date, "tb_pl_detail.com_grade_code": footerComGradeCode })
          .whereRaw("tb_pl.pl_id <> ?", [plId])
          .whereRaw("tb_pl.shipment_status_id <> ?", [11])
          .whereRaw("tb_pl.doc_status <> ?", [2])
          .orderBy("tb_pl.pl_id", "desc")
          .first()
      }
    } else {
      if (isSameGrade) {
        lastpl = await TbPL.find()
          .innerJoin("tb_pl_detail", "tb_pl.pl_id", "tb_pl_detail.pl_id")
          .where({ "tb_pl.ship_date": req.body.ship_date, "tb_pl_detail.com_grade_code": headerComGradeCode })
          .whereRaw("tb_pl.shipment_status_id <> ?", [11])
          .whereRaw("tb_pl.doc_status <> ?", [2])
          .orderBy("tb_pl.pl_id", "desc")
          .first()
      } else {
        lastpl = await TbPL.find()
          .innerJoin("tb_pl_detail", "tb_pl.pl_id", "tb_pl_detail.pl_id")
          .where({ "tb_pl.ship_date": req.body.ship_date, "tb_pl_detail.com_grade_code": footerComGradeCode })
          .whereRaw("tb_pl.shipment_status_id <> ?", [11])
          .whereRaw("tb_pl.doc_status <> ?", [2])
          .orderBy("tb_pl.pl_id", "desc")
          .first()
      }
    }

    // ตัดรหัสโรงงานก่อนหน้าออก
    let lastPlantId = null
    if (lastpl) {
      lastPlantId = _.get(lastpl, "plant_id", null)
      // truckplantids = truckplantids.filter((v) => parseInt(v) !== parseInt(plantId))
    }

    // ถ้ามีการกำหนดโรงงาน จะเข้าได้เฉพาะโรงงานที่กำหนด
    if (fixplant) {
      const ids = []
      const plantId = parseInt(_.get(fixplant, "plant_id"))
      ids.push(plantId)
      truckplantids = ids
    }

    truckplantids = truckplantids.map((v) => parseInt(v))

    const hTotActwgt = parseFloat(_.get(req, "body.h_tot_actwgt", 0)) // น้ำหนักสุทธิส่วนหัว
    const fTotActwgt = parseFloat(_.get(req, "body.f_tot_actwgt", 0)) // น้ำหนักสุทธิส่วนหาง

    // ถ้าเป็นเกรดเดียว
    if (isSameGrade) {
      steps.push({ step: 1, description: "เป็นเกรดเดียว" })

      const header = await this.getPlPlan(
        res,
        hprdgrade,
        truckplantids,
        req.body.ship_date,
        plId,
        hTotActwgt,
        trucktype.stdtime_loding,
        []
      )
      steps.push(...header.steps)
      pcplans = header.pcplans

      // const prdGradeId = _.get(hprdgrade, 'prd_grade_id') // รหัสกลุ่มเกรด
      // let plans = await TbPL.getPcPlanList2(req.body.ship_date, prdGradeId, plId)
      // steps.push({ step: 2, description: 'ค้นหารายการแผน', params: { ship_date: req.body.ship_date, prdGradeId: prdGradeId, plId: plId }, plans: plans })

      // // หารายการแผนที่สามารถกำหนดโรงงานได้
      // plans = _.filter(plans, (plan) => {
      //   return truckplantids.includes(parseInt(plan.plant_id)) && plan.sum_tot_actwgt < plan.prd_grade_qty
      // })

      // steps.push({ step: 3, description: 'หารายการแผนที่สามารถกำหนดโรงงานได้ ซึ่งยอดจองต้องน้อยกว่ายอดแผน', params: { truckplantids: truckplantids }, plans: plans })

      // steps.push({ step: 4, description: 'หารายการแผนที่สามารถระบุช่วงเวลาได้', plans: plans })
      // for (let i = 0; i < plans.length; i++) {
      //   const pcplan = plans[i];
      //   let slottimes = await TbPL.getSlotTimeAvailble(req.body.ship_date, trucktype.stdtime_loding, pcplan.plant_id)
      //   steps.push({ step: '4.1', description: 'หาช่วงเวลา', params: { ship_date: req.body.ship_date, stdtime_loding: trucktype.stdtime_loding, plant_id: pcplan.plant_id }, slottimes: slottimes })

      //   slottimes = _.map(slottimes, (item) => {
      //     return updateObject(item, {
      //       unix_time_begin: convertUnnixtime(`${req.body.ship_date} ${item.time_begin}`),
      //       unix_time_end: convertUnnixtime(`${req.body.ship_date} ${item.time_end}`),
      //     });
      //   })
      //     .filter(row => {
      //       let disabled = false
      //       if (_.get(hprdgrade, 'begin_time', null) && _.get(hprdgrade, 'end_time', null)) {
      //         const gstunix = convertUnnixtime(`${req.body.ship_date} ${hprdgrade.begin_time}`)
      //         const gedunix = convertUnnixtime(`${req.body.ship_date} ${hprdgrade.end_time}`)

      //         if (row.unix_time_begin < gstunix || row.unix_time_end > gedunix) {
      //           disabled = true
      //         }
      //       }
      //       return row.cap_avalible === 'Y' && !disabled
      //     })

      //   steps.push({ step: '4.1', description: 'ช่วงเวลาที่สามารถลงได้', params: { ship_date: req.body.ship_date, stdtime_loding: trucktype.stdtime_loding, plant_id: pcplan.plant_id, hprdgrade: hprdgrade }, slottimes: slottimes })

      //   if (slottimes.length) {
      //     pcplans.push(updateObject({}, pcplan))
      //   }
      // }

      // steps.push({ step: 5, description: 'รายการแผนที่ลงช่วงเวลาได้', pcplans: pcplans })

      // steps.push({ step: 6, description: 'รายการแผนที่ยอดจองยังไม่เต็ม' })

      // pcplans = _.filter(pcplans, (pcplan) => {
      //   // รวมยอดจองทั้งหมด
      //   let totalTotActwgt = parseFloat(pcplan.total_tot_actwgt_1) + parseFloat(pcplan.total_tot_actwgt_2)
      //   // ยอดแผน
      //   const prdGradeQty = parseFloat(pcplan.prd_grade_qty)

      //   // เปอร์เซ็นที่จองไปแล้ว
      //   let percent = parseInt((totalTotActwgt / prdGradeQty) * 100)

      //   if(percent > 100) {
      //     return false
      //   }

      //   // ถ้ามีการแก้ไขให้เอาน้ำหนักที่จองกับน้ำหนักที่แก้ไขมารวมกันจะได้น้ำหนักทั้งหมด
      //   if (plId) {
      //     totalTotActwgt = totalTotActwgt + hTotActwgt
      //     percent = parseInt((totalTotActwgt / prdGradeQty) * 100)
      //   }

      //   steps.push({ step: '6.1', description: 'รายการแผนที่ยอดจองยังไม่เต็ม', pcplan: pcplan, totalTotActwgt: totalTotActwgt, percent: percent, hTotActwgt: hTotActwgt })

      //   return percent >= 0
      // })

      // ถ้ามีรายการจองล่าสุด
      if (lastPlantId && truckplantids.includes(lastPlantId)) {
        steps.push({ step: 8, description: "มีรายการจองล่าสุด", lastpl: lastpl })

        if (pcplans.length > 1) {
          pcplans = _.filter(pcplans, (pcplan) => {
            return parseInt(pcplan.plant_id) !== parseInt(lastPlantId)
          })
        }

        steps.push({ step: 9, description: "ตัดแผนที่มีรหัสโรงงานตรงกับรายการจองล่าสุด", pcplans: pcplans })

        // ถ้ามีการกำหนดโรงงาน
        if (fixplant) {
          pcplans = _.filter(pcplans, (pcplan) => {
            return parseInt(pcplan.plant_id) === parseInt(_.get(fixplant, "plant_id"))
          })
          steps.push({ step: 10, description: "มีการกำหนดโรงงาน", pcplans: pcplans })
        } else {
          steps.push({ step: 10, description: "ไม่มีการกำหนดโรงงาน", pcplans: pcplans })
        }

        if (pcplans.length) {
          pcplan = _.get(pcplans, "[0]", null)
          plantIdSelected = _.get(pcplan, "plant_id", null)
          const result = this.calculateOverPlan(pcplan, hTotActwgt)
          pcplan = updateObject(pcplan, {
            plan_header: result,
            plan_footer: result,
          })
        }

        steps.push({ step: 11, description: "สรุปแผนที่สามารถลงได้", pcplan: pcplan })
      } else {
        steps.push({ step: 8, description: "ยังไม่มีรายการจองล่าสุด" })

        steps.push({ step: 9, description: "แผนที่สามารถลงได้ทั้งหมด", pcplans: pcplans })

        // ถ้ามีการกำหนดโรงงาน
        if (fixplant) {
          pcplans = _.filter(pcplans, (pcplan) => {
            return parseInt(pcplan.plant_id) === parseInt(_.get(fixplant, "plant_id"))
          })
          steps.push({ step: 10, description: "มีการกำหนดโรงงาน", pcplans: pcplans })
        } else {
          steps.push({ step: 10, description: "ไม่มีการกำหนดโรงงาน", pcplans: pcplans })
        }

        pcplan = _.get(pcplans, "[0]", null)

        if (pcplan) {
          plantIdSelected = _.get(pcplans, "[0].plant_id", null)
          const result = this.calculateOverPlan(pcplan, hTotActwgt)
          pcplan = updateObject(pcplan, {
            plan_header: result,
            plan_footer: result,
          })
        }

        steps.push({ step: 11, description: "สรุปแผนที่สามารถลงได้", pcplan: pcplan })
      }
    } else {
      steps.push({ step: 1, description: "เป็นคนละเกรด" })

      const header = await this.getPlPlan(
        res,
        hprdgrade,
        truckplantids,
        req.body.ship_date,
        plId,
        hTotActwgt,
        trucktype.stdtime_loding,
        []
      )
      const footer = await this.getPlPlan(
        res,
        fprdgrade,
        truckplantids,
        req.body.ship_date,
        plId,
        fTotActwgt,
        trucktype.stdtime_loding,
        []
      )
      steps.push({ flag: "ส่วนหัว", steps: header.steps })
      steps.push({ flag: "ส่วนหาง", steps: footer.steps })

      const hpcplans = _.get(header, "pcplans", [])
      const fpcplans = _.get(footer, "pcplans", [])

      steps.push({ step: 7, description: "รายการแผนส่วนหัว", pcplans: hpcplans })
      steps.push({ step: 7, description: "รายการแผนส่วนหาง", pcplans: fpcplans })

      pcplans = _.intersectionBy(hpcplans, fpcplans, "plant_id")

      steps.push({ step: 8, description: "รายการแผนส่วนหัวและส่วนหางที่มีรหัสโรงงานเหมือนกัน", pcplans: pcplans })

      if (lastPlantId && truckplantids.includes(lastPlantId)) {
        steps.push({ step: 9, description: "มีรายการจองล่าสุด", lastpl: lastpl })

        if (pcplans.length > 1) {
          pcplans = _.filter(pcplans, (pcplan) => {
            return parseInt(pcplan.plant_id) !== parseInt(lastPlantId)
          })
        }

        steps.push({ step: 10, description: "ตัดแผนที่มีรหัสโรงงานตรงกับรายการจองล่าสุด", pcplans: pcplans })

        // ถ้ามีการกำหนดโรงงาน
        if (fixplant) {
          pcplans = _.filter(pcplans, (pcplan) => {
            return parseInt(pcplan.plant_id) === parseInt(_.get(fixplant, "plant_id"))
          })
          steps.push({ step: 11, description: "มีการกำหนดโรงงาน", pcplans: pcplans })
        } else {
          steps.push({ step: 11, description: "ไม่มีการกำหนดโรงงาน", pcplans: pcplans })
        }

        if (pcplans.length) {
          pcplan = _.get(pcplans, "[0]", null)
          plantIdSelected = _.get(pcplan, "plant_id", null)
          // const result = this.calculateOverPlan(pcplan, hTotActwgt)
          pcplan = updateObject(pcplan, {
            plan_header: updateObject({}, hpcplans),
            plan_footer: updateObject({}, fpcplans),
          })
        }

        steps.push({ step: 12, description: "สรุปแผนที่สามารถลงได้", pcplan: pcplan })
      } else {
        steps.push({ step: 8, description: "ยังไม่มีรายการจองล่าสุด" })

        steps.push({ step: 9, description: "แผนที่สามารถลงได้ทั้งหมด", pcplans: pcplans })

        // ถ้ามีการกำหนดโรงงาน
        if (fixplant) {
          pcplans = _.filter(pcplans, (pcplan) => {
            return parseInt(pcplan.plant_id) === parseInt(_.get(fixplant, "plant_id"))
          })
          steps.push({ step: 10, description: "มีการกำหนดโรงงาน", pcplans: pcplans })
        } else {
          steps.push({ step: 10, description: "ไม่มีการกำหนดโรงงาน", pcplans: pcplans })
        }

        pcplan = _.get(pcplans, "[0]", null)

        if (pcplan) {
          plantIdSelected = _.get(pcplans, "[0].plant_id", null)
          // const result = this.calculateOverPlan(pcplan, hTotActwgt)
          pcplan = updateObject(pcplan, {
            plan_header: updateObject({}, hpcplans),
            plan_footer: updateObject({}, fpcplans),
          })
        }

        steps.push({ step: 11, description: "สรุปแผนที่สามารถลงได้", pcplan: pcplan })
      }
    }

    if (!isNewRecord) {
      const header = await TbPLDetail.findOne({ pl_id: plId, pl_seq: 1 })
      const footer = await TbPLDetail.findOne({ pl_id: plId, pl_seq: 2 })
      // เกรดเดียวกัน
      if (isSameGrade) {
        const isMatchTruckwgt = parseFloat(header.truckwgt) === parseFloat(formHeader.truckwgt)
        const isMatchTotTruckwgt = parseFloat(header.tot_truckwgt) === parseFloat(formHeader.tot_truckwgt)
        const isMatchTotActwgt = parseFloat(header.tot_actwgt) === parseFloat(formHeader.tot_actwgt)
        const isMatchShipDate = parseFloat(req.body.ship_date) === parseFloat(pl.ship_date)
        if (
          isMatchTruckwgt &&
          isMatchTotTruckwgt &&
          isMatchTotActwgt &&
          isMatchShipDate &&
          plantIdSelected === parseInt(pl.plant_id)
        ) {
          plantIdSelected = parseInt(pl.plant_id)
        }
      } else {
        const isMatchTruckwgtH = parseFloat(header.truckwgt) === parseFloat(formHeader.truckwgt)
        const isMatchTotTruckwgtH = parseFloat(header.tot_truckwgt) === parseFloat(formHeader.tot_truckwgt)
        const isMatchTotActwgtH = parseFloat(header.tot_actwgt) === parseFloat(formHeader.tot_actwgt)

        const isMatchTruckwgtF = parseFloat(footer.truckwgt) === parseFloat(formFooter.truckwgt)
        const isMatchTotTruckwgtF = parseFloat(footer.tot_truckwgt) === parseFloat(formFooter.tot_truckwgt)
        const isMatchTotActwgtF = parseFloat(footer.tot_actwgt) === parseFloat(formFooter.tot_actwgt)
        const isMatchShipDate = parseFloat(req.body.ship_date) === parseFloat(pl.ship_date)

        const isMacthHeader = isMatchTruckwgtH && isMatchTotTruckwgtH && isMatchTotActwgtH
        const isMacthFooter = isMatchTruckwgtF && isMatchTotTruckwgtF && isMatchTotActwgtF

        if (isMacthHeader && isMacthFooter && isMatchShipDate) {
          plantIdSelected = parseInt(pl.plant_id)
        }
      }
    }

    res.json({
      headerComGradeCode: headerComGradeCode,
      footerComGradeCode: footerComGradeCode,
      isNewRecord: isNewRecord,
      pl_id: plId,
      pl: pl,
      is_same_grade: isSameGrade,
      truck_type: trucktype,
      truck_type_plants: trucktypeplants,
      truck_plant_ids: truckplantids,
      hgrade: hgrade,
      hprdgrade: hprdgrade,
      fgrade: fgrade,
      fprdgrade: fprdgrade,
      firstpl: firstpl,
      lastpl: lastpl,
      fixplant: fixplant,
      h_tot_actwgt: hTotActwgt,
      f_tot_actwgt: fTotActwgt,
      formHeader: formHeader,
      formFooter: formFooter,
      steps: steps,
      plantIdSelected: plantIdSelected,
      pcplan: pcplan,
      plant_id: plantIdSelected,
    })
  } catch (error) {
    console.log(error.stack)
    res.status(error.status || 500).json({ message: error.message })
  }
}

exports.getPlPlan = async (res, prdgrade, truckplantids, shipDate, plId, totActwgt, stdtimeLoding, steps) => {
  try {
    let pcplans = []
    const prdGradeId = _.get(prdgrade, "prd_grade_id") // รหัสกลุ่มเกรด
    let plans = await TbPL.getPcPlanList2(shipDate, prdGradeId, plId)
    steps.push({
      step: 2,
      description: "ค้นหารายการแผน",
      params: { ship_date: shipDate, prdGradeId: prdGradeId, plId: plId },
      plans: plans,
    })

    // หารายการแผนที่สามารถกำหนดโรงงานได้
    plans = _.filter(plans, (plan) => {
      return truckplantids.includes(parseInt(plan.plant_id)) && plan.sum_tot_actwgt < plan.prd_grade_qty
    })

    plans = _.orderBy(plans, ["plant_id", "prd_grade_qty"], ["asc", "desc"])

    steps.push({
      step: 3,
      description: "หารายการแผนที่สามารถกำหนดโรงงานได้ ซึ่งยอดจองต้องน้อยกว่ายอดแผน",
      params: { truckplantids: truckplantids },
      plans: plans,
    })

    steps.push({ step: 4, description: "หารายการแผนที่สามารถระบุช่วงเวลาได้", plans: plans })

    for (let i = 0; i < plans.length; i++) {
      const pcplan = plans[i]
      let slottimes = await TbPL.getSlotTimeAvailble(shipDate, stdtimeLoding, pcplan.plant_id)
      steps.push({
        step: "4.1",
        description: "หาช่วงเวลา",
        params: { ship_date: shipDate, stdtime_loding: stdtimeLoding, plant_id: pcplan.plant_id },
        slottimes: slottimes,
      })

      slottimes = _.map(slottimes, (item) => {
        return updateObject(item, {
          unix_time_begin: convertUnnixtime(`${shipDate} ${item.time_begin}`),
          unix_time_end: convertUnnixtime(`${shipDate} ${item.time_end}`),
        })
      }).filter((row) => {
        let disabled = false
        if (_.get(prdgrade, "begin_time", null) && _.get(prdgrade, "end_time", null)) {
          const gstunix = convertUnnixtime(`${shipDate} ${prdgrade.begin_time}`)
          const gedunix = convertUnnixtime(`${shipDate} ${prdgrade.end_time}`)

          if (row.unix_time_begin < gstunix || row.unix_time_end > gedunix) {
            disabled = true
          }
        }
        return row.cap_avalible === "Y" && !disabled
      })

      steps.push({
        step: "4.1.1",
        description: "ช่วงเวลาที่สามารถลงได้",
        params: { ship_date: shipDate, stdtime_loding: stdtimeLoding, plant_id: pcplan.plant_id, prdgrade: prdgrade },
        slottimes: slottimes,
      })

      if (slottimes.length) {
        pcplans.push(updateObject({}, pcplan))
      }
    }

    steps.push({ step: 5, description: "รายการแผนที่ลงช่วงเวลาได้", pcplans: pcplans })

    steps.push({ step: 6, description: "หารายการแผนที่ยอดจองยังไม่เต็ม" })

    pcplans = _.filter(pcplans, (pcplan) => {
      // รวมยอดจองทั้งหมด
      let totalTotActwgt = parseFloat(pcplan.total_tot_actwgt_1) + parseFloat(pcplan.total_tot_actwgt_2)
      // ยอดแผน
      const prdGradeQty = parseFloat(pcplan.prd_grade_qty)

      // เปอร์เซ็นที่จองไปแล้ว
      let percent = parseInt((totalTotActwgt / prdGradeQty) * 100)

      if (percent > 100) {
        return false
      }

      // ถ้ามีการแก้ไขให้เอาน้ำหนักที่จองกับน้ำหนักที่แก้ไขมารวมกันจะได้น้ำหนักทั้งหมด
      if (plId) {
        totalTotActwgt = totalTotActwgt + totActwgt
        percent = parseInt((totalTotActwgt / prdGradeQty) * 100)
      }

      steps.push({
        step: "6.1",
        description: "รายการแผนที่ยอดจองยังไม่เต็ม",
        pcplan: pcplan,
        totalTotActwgt: totalTotActwgt,
        percent: percent,
        totActwgt: totActwgt,
      })

      return percent >= 0
    })

    return {
      pcplans: pcplans,
      steps: steps,
    }
  } catch (error) {
    return Promise.reject(error)
  }
}

exports.calculateOverPlan = (pcplan, totActwgt) => {
  if (!pcplan) {
    return {
      is_over_plan: false,
      over_plan_total: 0,
    }
  }
  // รวมยอดจองทั้งหมด
  const totalTotActwgt = parseFloat(pcplan.total_tot_actwgt_1) + parseFloat(pcplan.total_tot_actwgt_2)
  // ยอดแผน
  const prdGradeQty = parseFloat(pcplan.prd_grade_qty)
  // รวมยอดจองทั้งหมด + น้ำหนักสุทธิ > ยอดแผน
  const isOverPlant = totalTotActwgt > prdGradeQty
  // const overPlantTotal = totalTotActwgt + totActwgt - prdGradeQty

  return {
    is_over_plan: isOverPlant,
    sum_tot_actwgt: pcplan.sum_tot_actwgt,
    prd_grade_qty: pcplan.prd_grade_qty,
    total_tot_actwgt_1: pcplan.total_tot_actwgt_1,
    total_tot_actwgt_2: pcplan.total_tot_actwgt_2,
    balance: prdGradeQty - (totalTotActwgt + totActwgt),
  }
}

const convertUnnixtime = (datetime) => {
  return parseFloat(moment(datetime, "YYYY-MM-DD HH:mm:ss").format("X"))
}

const updateObject = (oldObject, updatedProperties) => {
  return {
    ...oldObject,
    ...updatedProperties,
  }
}

const mapSlotTimes = (slottimes = [], times = []) => {
  const timebegins = _.map(slottimes, (item) => item.time_begin)

  for (let i = 0; i < times.length; i++) {
    let item = times[i];
    if (!timebegins.includes(item.time_begin)) {
      item = updateObject(item, {
        "cab_flag": "N",
        "disabled": true
      })
      slottimes.push(item)
    }
  }
  slottimes = _.orderBy(slottimes, ["time_begin"], ["asc"])

  return slottimes
}

const checkPcPlanBalance = (pcplan) => {
  // รวมยอดจองทั้งหมด
  let totalTotActwgt = parseFloat(pcplan.total_tot_actwgt_1) + parseFloat(pcplan.total_tot_actwgt_2)
  // ยอดแผน
  const prdGradeQty = parseFloat(pcplan.prd_grade_qty)

  // เปอร์เซ็นที่จองไปแล้ว
  let percent = parseInt((totalTotActwgt / prdGradeQty) * 100)

  // ถ้ายอดจองมากกว่ายอดแผน เท่ากับ แผนนั้นเต็ม
  if (totalTotActwgt > 0 && totalTotActwgt >= prdGradeQty) {
    return false
  } else if (percent >= 100) {
    return false
  } else if (totalTotActwgt === 0) {
    return true
  } else if (totalTotActwgt > 0 && totalTotActwgt < prdGradeQty) {
    return true
  } else {
    return true
  }
}

const getSlottimeToPcPlan = async (pcplans = [], plans = [], shipDate, prdgrade) => {
  try {
    for (let i = 0; i < plans.length; i++) {
      const plan = plans[i]
      let slottimes = await TbPL.getSlotTimeAvailble2(
        shipDate,
        plan.plant_id,
        plan.pc_capacity,
        plan.begin_time,
        plan.end_time
      )
      slottimes = _.map(slottimes, (item) => {
        let disabled = false
        if (_.get(prdgrade, "begin_time", null) && _.get(prdgrade, "end_time", null)) {
          const gstunix = convertUnnixtime(`${shipDate} ${prdgrade.begin_time}`)
          const gedunix = convertUnnixtime(`${shipDate} ${prdgrade.end_time}`)

          if (
            convertUnnixtime(`${shipDate} ${item.time_begin}`) < gstunix ||
            convertUnnixtime(`${shipDate} ${item.time_end}`) > gedunix
          ) {
            disabled = true
          }
        }
        return updateObject(item, {
          disabled: disabled || item.cab_flag === "N" ? true : false,
        })
      })
      const itemlen = _.filter(slottimes, (item) => item.cab_flag === "Y" && !item.disabled).length
      // steps.push({
      //   step: 4,
      //   description: "หาช่วงเวลา",
      //   params: {
      //     ship_date: req.body.ship_date,
      //     plant_id: plan.plant_id,
      //     pc_capacity: plan.pc_capacity,
      //     begin_time: plan.begin_time,
      //     end_time: plan.end_time,
      //   },
      //   slottimes: slottimes,
      // })
      if (itemlen > 0) {
        pcplans.push(updateObject(plan, { slottimes: slottimes }))
      }
    }
    return pcplans
  } catch (error) {
    return Promise.reject(error)
  }
}

exports.getSlotTimeAvailable = async (req, res) => {
  try {
    req.assert(req.query.date, 400, 'invalid date.')
    req.assert(req.query.truck_type_id, 400, 'invalid truck_type_id.')
    req.assert(req.query.plant_id, 400, 'invalid plant_id.')

    const trucktype = await TbTruckType.findOneById(req.query.truck_type_id)
    const items = await TbPL.getSlotTimeAvailble(req.query.date, trucktype.stdtime_loding, req.query.plant_id)

    let slottimes = await TbPL.getSlotTimeAvailble2(
      req.query.date,
      req.query.plant_id,
      plan.pc_capacity,
      plan.begin_time,
      plan.end_time
    )
    slottimes = _.map(slottimes, (item) => {
      let disabled = false
      if (_.get(prdgrade, "begin_time", null) && _.get(prdgrade, "end_time", null)) {
        const gstunix = convertUnnixtime(`${shipDate} ${prdgrade.begin_time}`)
        const gedunix = convertUnnixtime(`${shipDate} ${prdgrade.end_time}`)

        if (
          convertUnnixtime(`${shipDate} ${item.time_begin}`) < gstunix ||
          convertUnnixtime(`${shipDate} ${item.time_end}`) > gedunix
        ) {
          disabled = true
        }
      }
      return updateObject(item, {
        disabled: disabled || item.cab_flag === "N" ? true : false,
      })
    })
    res.success(items)
  } catch (err) {
    res.error(err)
  }
}

exports.getSlotTimes = async (req, res) => {
  try {
    const pl = await TbPL.findOneById(req.query.id)
    const pcprd = await db('tb_pc_prd_qty').select(['*']).from('tb_pc_prd_qty').where({ pc_prd_qty_id: pl.pc_prd_qty_id }).first()
    const prdgrade = await TbPrdGrade.findOneById(pcprd.prd_grade_id)

    let plantIds = []
    plantIds.push(pl.plant_id)
    let plans = await TbPL.getPcPlanList3(pl.ship_date, pcprd.prd_grade_id, plantIds, pl.pl_id)
    plans = _.filter(plans, (pcplan) => checkPcPlanBalance(pcplan))

    let pcplans = []
    pcplans = await getSlottimeToPcPlan(pcplans, plans, pl.ship_date, prdgrade)

    const times = await TbPL.getSlotTimeList()

    const pcPlan = _.get(pcplans, '[0]')
    let slottimes = _.get(pcPlan, "slottimes", []).filter(item => item.cab_flag === 'Y' && !item.disabled) // ช่วงเวลาส่วนหัว
    if (slottimes.length) {
      slottimes = mapSlotTimes(slottimes, times)
      return res.send(updateObject(pcPlan, { slottimes: slottimes }))
    }
    return res.send([])
  } catch (error) {
    res.send(error.message)
  }
}