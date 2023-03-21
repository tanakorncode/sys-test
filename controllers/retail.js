const _ = require('lodash')
const moment = require('moment')
const qs = require('qs')
const fetch = require('node-fetch')
const Bluebird = require("bluebird");
const axios = require('axios').default
const TbRet = require('../models/mysql/ret')
const TbTrd = require('../models/mysql/trd')
const TbTrdConfirm = require('../models/mysql/trd_confirm')
const User = require('../models/mysql/user')
const randomstring = require('randomstring')
const Profile = require('../models/mysql/profile')
const bcrypt = require('bcrypt')
const assert = require("http-assert")
moment.locale('th')

axios.defaults.baseURL = process.env.SYS_API_BASE_URL;
axios.defaults.headers.common['Authorization'] = `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjp7ImlkIjoyLCJ1c2VybmFtZSI6InNtYXJ0Y2FyZSIsIm5hbWUiOiJTbWFydCBDYXJlIn0sIm5hbWUiOiJTbWFydCBDYXJlIiwianRpIjoyLCJpYXQiOjE2NzYyMDc3MDQsIm5iZiI6MTY3NjIwNzcwNCwiZXhwIjoxNjc2ODEyNTA0LCJpc3MiOiJodHRwczovL3d3dy5zeXNzY3JhcHF1ZXVlcy5jb20ifQ.bL0qck-YFwD1KQTWQ83KQ6wFe4YnmMLanxoZMbkpE14`
// Add a request interceptor
axios.interceptors.request.use(function (config) {
  // Do something before request is sent
  return config;
}, function (error) {
  // Do something with request error
  return Promise.reject(error);
});

// Add a response interceptor
axios.interceptors.response.use(
  function (response) {
    if (_.get(response, 'data.data')) {
      return _.get(response, 'data.data')
    }
    return response
  },
  function (error) {
    return Promise.reject(error)
  }
)

exports.postImport = async (req, res) => {
  try {
    const token = req.headers.authorization && req.headers.authorization.split(' ')[1]
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    const config = {
      method: 'GET',
      headers: headers,
    }

    let retails = trimValue(req.body.retails)
    let importRetcodes = _.map(retails, 'ret_code')
    const effdateTo = _.get(req.body, 'effdate_to', `${moment().format('YYYY')}-12-31`)
    const filterParamsContract = {
      filter: {
        pyear: _.get(req.body, 'pyear', moment().format('YYYY')),
        status: 'A',
        tot_actwgt: {
          '>': 0,
        },
        effdate_to: {
          '>%3D': effdateTo,
        },
      },
    }
    let contractlist = await fetchContracts(config, filterParamsContract)
    contractlist = _.filter(contractlist, (item) => importRetcodes.includes(item.ret_code)) // เอาเฉพาะรายชื่อที่จะนำเข้า

    // ค้นหาข้อมูลตารางราคาล่าสุด
    const filterAllParams = {
      filter: {
        pyear: moment().format('YYYY'),
        effdate_to: {
          '>%3D': effdateTo,
        },
        status: "A",
      },
    }
    let pricelist = await fetchPriceList(config, filterAllParams, effdateTo)
    pricelist = _.filter(pricelist, (item) => importRetcodes.includes(item.ret_code)) // เอาเฉพาะรายชื่อที่จะนำเข้า

    let maptrdcodes = _.uniq(_.map(contractlist, 'trd_code'))
    let mapretcodes = _.uniq(_.map(contractlist, 'ret_code'))

    maptrdcodes = maptrdcodes.concat(_.uniq(_.map(pricelist, 'trd_code')))
    mapretcodes = mapretcodes.concat(_.uniq(_.map(pricelist, 'ret_code')))

    let trdcodes = _.uniq(maptrdcodes)
    let retcodes = _.uniq(mapretcodes)

    // รายชื่อผู้ขายทั้งหมดที่มีในระบบ
    let traders = await fetchTraders(config)
    traders = _.filter(traders, (trader) => trdcodes.includes(trader.trd_code)) // เอาเฉพาะรายชื่อผู้ขายที่มีใน pricelist, contractlist

    const mapRetails = []
    for (let i = 0; i < retails.length; i++) {
      let retail = retails[i];
      const traders1 = _.filter(contractlist, (item) => item.ret_code === retail.ret_code)
      const traders2 = _.filter(pricelist, (item) => item.ret_code === retail.ret_code)
      const traders = _.uniqBy(traders1.concat(traders2), 'trd_code')

      // ลบ field ที่มีค่า null ออก
      retail = _.pickBy(retail, (v) => v !== null && v !== undefined && v !== '')
      // ลบ field ที่ไม่ต้องการนำเข้าข้อมูลออก
      let retattributes = _.omit(retail, [
        'fax',
        'create_by',
        'create_date',
        'change_by',
        'change_date',
        'msrepl_tran_version',
        'RetailGroupID',
      ])

      retail = updateObject(retattributes, { traders: traders })

      // ค้นหาข้อมูลร้านค้าจากฐานข้อมูลว่ามีข้อมุลเดิมอยู่หรือเปล่า?
      let modelretail = await TbRet.findOne({ ret_code: retail.ret_code })
      if (modelretail) {
        // update
        modelretail = _.omit(modelretail, ['pdpa_agreement'])
        modelretail = updateObject(modelretail, retattributes)
        const attributes = updateObject(modelretail, {
          ret_id: modelretail.ret_id,
          updated_at: moment().format('YYYY-MM-DD HH:mm:ss'),
          updated_by: modelretail.updated_by,
          ret_status_id: 1,
        })
        // validate
        const values = TbRet.schemas().validateSync(attributes)
        const updated = await new TbRet(values).save()
        const retId = _.get(updated, '[0]', modelretail.ret_id)
        // unblock user
        if (modelretail.user_id) {
          await new User({ id: modelretail.user_id, blocked_at: null }).save()
        }

        // create and update traders
        for (let i = 0; i < traders.length; i++) {
          const trader = traders[i];
          const trd = await TbTrd.findOne({ trd_code: trader.trd_code })
          if (trd) {
            const trdConfirm = await TbTrdConfirm.findOne({ trd_id: trd.trd_id, ret_id: retId })
            if (!trdConfirm) {
              const valuesConfirm = TbTrdConfirm.schemas().validateSync({
                trd_id: trd.trd_id,
                ret_id: retId,
                confirm_status: 'Y',
                created_by: trd.created_by,
                updated_by: trd.updated_by,
              })
              // save
              const trdConInserted = await new TbTrdConfirm(valuesConfirm).save()
            } else {
              const valuesConfirm = TbTrdConfirm.schemas().validateSync({
                trd_confirm_id: parseInt(trdConfirm.trd_confirm_id),
                trd_id: trd.trd_id,
                ret_id: retId,
                confirm_status: 'Y',
                updated_by: trd.updated_by,
                updated_at: moment().format('YYYY-MM-DD HH:mm:ss')
              })
              // save
              const trdConUpdated = await new TbTrdConfirm(valuesConfirm).save()
            }
            await TbTrdConfirm.updateRetailNotConfirm(retId, trd.trd_id)
            // update trd
            await new TbTrd({
              trd_id: trd.trd_id,
              trd_status_id: 1,
              updated_at: moment().format('YYYY-MM-DD HH:mm:ss')
            }).save()
            // unblock user
            if (trd.user_id) {
              await new User({ id: trd.user_id, blocked_at: null }).save()
            }
          } else {
            let attributes = _.omit(trader, [
              'trd_class',
              'eval_grade',
              'create_by',
              'create_date',
              'change_by',
              'change_date',
              'msrepl_tran_version',
            ])
            // set default value
            const email = `trd${String(trader.trd_code).toLowerCase()}@gmail.com` // อีเมลที่เข้าใช้งานระบบ
            const username = `usys${String(trader.trd_code).toLowerCase()}` // ชื่อผู้้ใช่งานที่เขา้สูระบบ
            const password = `psys${String(trader.trd_code).toLowerCase()}` // รหัสผ่านที่เข้าสู่ระบบ

            attributes = updateObject(attributes, {
              // created_by: createdBy,
              // updated_by: createdBy,
              created_at: moment().format('YYYY-MM-DD HH:mm:ss'),
              updated_at: moment().format('YYYY-MM-DD HH:mm:ss'),
              trd_status_id: 1,
            })

            // validate
            const values = TbTrd.schemas().validateSync(attributes)
            // save
            const inserted = await new TbTrd(values).save()
            const trdId = _.get(inserted, '[0]')

            // insert user
            const checkEmail = await User.findByUsernameOrEmail(email)
            // req.assert(!checkEmail, 400, `อีเมลนี้ถูกใช้แล้ว.`)

            const checkUsername = await User.findByUsernameOrEmail(username)
            // req.assert(!checkUsername, 400, `ชื่อผู้ใช้นี้ถูกใช้แล้ว.`)

            if (!checkEmail && !checkUsername) {
              const pwdHash = bcrypt.hashSync(password, 12)
              const time = Math.floor(Date.now() / 1000)
              const userAttr = {
                username: username,
                email: email,
                password_hash: pwdHash,
                auth_key: randomstring.generate(),
                confirmed_at: time,
                registration_ip: req.ip,
                created_at: time,
                updated_at: time,
                flags: 0,
                user_type_id: 3, // ผู้ขาย
              }

              const user = await new User(userAttr).save()
              const userId = user[0]
              await new Profile({ user_id: userId, timezone: 'Asia/Bangkok' }, true).save()

              // update trader
              await new TbTrd(updateObject(values, { user_id: userId, trd_id: trdId })).save()

              // if (userRole) {
              //   await manager.assign(userRole, userId)
              // }
              // if (traderRole) {
              //   await manager.assign(traderRole, userId)
              // }
            } else {
              const userId = _.get(checkEmail, 'id')
              // update trader
              await new TbTrd(updateObject(values, { user_id: userId, trd_id: trdId })).save()
            }

            const trdConfirm = await TbTrdConfirm.findOne({ trd_id: trdId, ret_id: retId })
            if (!trdConfirm) {
              const valuesConfirm = TbTrdConfirm.schemas().validateSync({
                trd_id: trdId,
                ret_id: retId,
                confirm_status: 'Y',
                // created_by: trd.created_by,
                // updated_by: trd.updated_by,
              })
              // save
              const trdConInserted = await new TbTrdConfirm(valuesConfirm).save()
            } else {
              const valuesConfirm = TbTrdConfirm.schemas().validateSync({
                trd_confirm_id: parseInt(trdConfirm.trd_confirm_id),
                trd_id: trdId,
                ret_id: retId,
                confirm_status: 'Y',
                // updated_by: trd.updated_by,
                updated_at: moment().format('YYYY-MM-DD HH:mm:ss')
              })
              // save
              const trdConUpdated = await new TbTrdConfirm(valuesConfirm).save()
            }

            await TbTrdConfirm.updateRetailNotConfirm(retId, trdId)
          }
        }
      } else {
        // ลบ field ที่ไม่ต้องการนำเข้าข้อมูลออก
        let attributes = _.omit(retail, [
          'fax',
          'create_by',
          'create_date',
          'change_by',
          'change_date',
          'msrepl_tran_version',
          'RetailGroupID',
        ])

        // set default value
        const email = `ret${String(retail.ret_code).toLowerCase()}@gmail.com` // อีเมลที่เข้าใช้งานระบบ
        const username = `usys${String(retail.ret_code).toLowerCase()}` // ชื่อผู้้ใช่งานที่เขา้สูระบบ
        const password = `psys${String(retail.ret_code).toLowerCase()}` // รหัสผ่านที่เข้าสู่ระบบ

        // กำหนดข้อมูลเบื้องต้น
        attributes = updateObject(attributes, {
          ret_confirm: 'T',
          ret_email: _.get(retail, 'ret_email', email),
          fax1: item.fax,
          // created_by: createdBy,
          // updated_by: createdBy,
          created_at: moment().format('YYYY-MM-DD HH:mm:ss'),
          updated_at: moment().format('YYYY-MM-DD HH:mm:ss'),
          ret_status_id: 1,
          pdpa_agreement: '',
        })

        // validate
        const values = TbRet.schemas().validateSync(attributes)
        const inserted = await new TbRet(values).save()
        const retId = inserted[0]

        // insert user
        const checkEmail = await User.findByUsernameOrEmail(email)
        // req.assert(!checkEmail, 400, `อีเมลนี้ถูกใช้แล้ว.`)

        const checkUsername = await User.findByUsernameOrEmail(username)
        // req.assert(!checkUsername, 400, `ชื่อผู้ใช้นี้ถูกใช้แล้ว.`)

        if (!checkEmail && !checkUsername) {
          const pwdHash = bcrypt.hashSync(password, 12)
          const time = Math.floor(Date.now() / 1000)
          const userAttr = {
            username: username,
            email: email,
            password_hash: pwdHash,
            auth_key: randomstring.generate(),
            confirmed_at: time,
            registration_ip: req.ip,
            created_at: time,
            updated_at: time,
            flags: 0,
            user_type_id: 4, // ร้านค้า
          }

          const user = await new User(userAttr).save()
          const userId = user[0]
          await new Profile({ user_id: userId, timezone: 'Asia/Bangkok' }, true).save()

          // update retail
          await new TbRet(updateObject(values, { user_id: userId, ret_id: retId })).save()

          // if (userRole) {
          //   await manager.assign(userRole, userId)
          // }
          // if (retailRole) {
          //   await manager.assign(retailRole, userId)
          // }
        } else {
          const userId = _.get(checkEmail, 'id')
          // update retail
          await new TbRet(updateObject(values, { user_id: userId, ret_id: retailId })).save()
        }

        // create and update traders
        for (let i = 0; i < traders.length; i++) {
          const trader = traders[i];
          const trd = await TbTrd.findOne({ trd_code: trader.trd_code })
          if (trd) {
            const trdConfirm = await TbTrdConfirm.findOne({ trd_id: trd.trd_id, ret_id: retId })
            if (!trdConfirm) {
              const valuesConfirm = TbTrdConfirm.schemas().validateSync({
                trd_id: trd.trd_id,
                ret_id: retId,
                confirm_status: 'Y',
                created_by: trd.created_by,
                updated_by: trd.updated_by,
              })
              // save
              const trdConInserted = await new TbTrdConfirm(valuesConfirm).save()
            } else {
              const valuesConfirm = TbTrdConfirm.schemas().validateSync({
                trd_confirm_id: parseInt(trdConfirm.trd_confirm_id),
                trd_id: trd.trd_id,
                ret_id: retId,
                confirm_status: 'Y',
                updated_by: trd.updated_by,
                updated_at: moment().format('YYYY-MM-DD HH:mm:ss')
              })
              // save
              const trdConUpdated = await new TbTrdConfirm(valuesConfirm).save()
            }
            await TbTrdConfirm.updateRetailNotConfirm(retId, trd.trd_id)
            // update trd
            await new TbTrd({
              trd_id: trd.trd_id,
              trd_status_id: 1,
              updated_at: moment().format('YYYY-MM-DD HH:mm:ss')
            }).save()
            // unblock user
            if (trd.user_id) {
              await new User({ id: trd.user_id, blocked_at: null }).save()
            }
          } else {
            let attributes = _.omit(trader, [
              'trd_class',
              'eval_grade',
              'create_by',
              'create_date',
              'change_by',
              'change_date',
              'msrepl_tran_version',
            ])
            // set default value
            const email = `trd${String(trader.trd_code).toLowerCase()}@gmail.com` // อีเมลที่เข้าใช้งานระบบ
            const username = `usys${String(trader.trd_code).toLowerCase()}` // ชื่อผู้้ใช่งานที่เขา้สูระบบ
            const password = `psys${String(trader.trd_code).toLowerCase()}` // รหัสผ่านที่เข้าสู่ระบบ

            attributes = updateObject(attributes, {
              // created_by: createdBy,
              // updated_by: createdBy,
              created_at: moment().format('YYYY-MM-DD HH:mm:ss'),
              updated_at: moment().format('YYYY-MM-DD HH:mm:ss'),
              trd_status_id: 1,
            })

            // validate
            const values = TbTrd.schemas().validateSync(attributes)
            // save
            const inserted = await new TbTrd(values).save()
            const trdId = _.get(inserted, '[0]')

            // insert user
            const checkEmail = await User.findByUsernameOrEmail(email)
            // req.assert(!checkEmail, 400, `อีเมลนี้ถูกใช้แล้ว.`)

            const checkUsername = await User.findByUsernameOrEmail(username)
            // req.assert(!checkUsername, 400, `ชื่อผู้ใช้นี้ถูกใช้แล้ว.`)

            if (!checkEmail && !checkUsername) {
              const pwdHash = bcrypt.hashSync(password, 12)
              const time = Math.floor(Date.now() / 1000)
              const userAttr = {
                username: username,
                email: email,
                password_hash: pwdHash,
                auth_key: randomstring.generate(),
                confirmed_at: time,
                registration_ip: req.ip,
                created_at: time,
                updated_at: time,
                flags: 0,
                user_type_id: 3, // ผู้ขาย
              }

              const user = await new User(userAttr).save()
              const userId = user[0]
              await new Profile({ user_id: userId, timezone: 'Asia/Bangkok' }, true).save()

              // update trader
              await new TbTrd(updateObject(values, { user_id: userId, trd_id: trdId })).save()

              // if (userRole) {
              //   await manager.assign(userRole, userId)
              // }
              // if (traderRole) {
              //   await manager.assign(traderRole, userId)
              // }
            } else {
              const userId = _.get(checkEmail, 'id')
              // update trader
              await new TbTrd(updateObject(values, { user_id: userId, trd_id: trdId })).save()
            }

            const trdConfirm = await TbTrdConfirm.findOne({ trd_id: trdId, ret_id: retId })
            if (!trdConfirm) {
              const valuesConfirm = TbTrdConfirm.schemas().validateSync({
                trd_id: trdId,
                ret_id: retId,
                confirm_status: 'Y',
                // created_by: trd.created_by,
                // updated_by: trd.updated_by,
              })
              // save
              const trdConInserted = await new TbTrdConfirm(valuesConfirm).save()
            } else {
              const valuesConfirm = TbTrdConfirm.schemas().validateSync({
                trd_confirm_id: parseInt(trdConfirm.trd_confirm_id),
                trd_id: trdId,
                ret_id: retId,
                confirm_status: 'Y',
                // updated_by: trd.updated_by,
                updated_at: moment().format('YYYY-MM-DD HH:mm:ss')
              })
              // save
              const trdConUpdated = await new TbTrdConfirm(valuesConfirm).save()
            }

            await TbTrdConfirm.updateRetailNotConfirm(retId, trdId)
          }
        }
      }
      mapRetails.push(retail)
    }

    res.send({ contractlist, pricelist, effdateTo, retails, trdcodes, retcodes, traders, retails, mapRetails })
  } catch (error) {
    console.log(error.stack);
    res.send(error.message)
  }
}

const updateObject = (oldObject, updatedProperties) => {
  return {
    ...oldObject,
    ...updatedProperties,
  }
}

const fetchTraders = async (config) => {
  // รายชื่อผู้ขายทั้งหมดที่มีในระบบ
  const response = await fetch(`${process.env.SYS_API_BASE_URL}/ts-trader/list`, config)
  if (!response.ok) {
    throw new Error(response.statusText)
  }
  let traders = await response.json()
  traders = trimValue(traders)
  traders = _.get(traders, 'data.data', [])
  traders = _.filter(traders, (item) => item.trd_code !== null && item.trd_code !== undefined && item.trd_code !== '')

  return traders
}

const fetchContracts = async (config, params) => {
  const response = await fetch(`${process.env.SYS_API_BASE_URL}/ts-contract/list${toQueryString(params)}`, config)
  if (!response.ok) {
    throw new Error(response.statusText)
  }
  let contractlist = await response.json()
  contractlist = trimValue(contractlist)
  contractlist = _.get(contractlist, 'data.data', [])
  contractlist = _.filter(contractlist, (item) => item.trd_code !== null && item.trd_code !== undefined && item.trd_code !== '')
  contractlist = _.filter(contractlist, (item) => item.ret_code !== null && item.ret_code !== undefined && item.ret_code !== '')

  return contractlist
}

const fetchPriceList = async (config, params, effdateTo) => {
  const response = await fetch(`${process.env.SYS_API_BASE_URL}/ts-prices/list${toQueryString(params)}`, config)
  if (!response.ok) {
    throw new Error(response.statusText)
  }
  let pricelistAll = await response.json()
  pricelistAll = trimValue(pricelistAll) // ลบช่องว่างออกทั้งหมด
  pricelistAll = _.get(pricelistAll, 'data.data', [])
  pricelistAll = pricelistAll.filter(
    (row) => !isNumeric(row.ret_code) && row.ret_code !== null && row.ret_code !== undefined && row.ret_code !== ''
  ) // กรองเอาเฉพาะรายการที่มีรหัสร้านค้าและรหัสร้านค้าไม่ใช่ตัวเลข
  pricelistAll = pricelistAll.filter(
    (row) => row.trd_code !== null && row.trd_code !== undefined && row.trd_code !== ''
  ) // กรองเอาเฉพาะรายการที่มีรหัสผู้ขายและรหัสผู้ขายไม่ใช่ตัวเลข
  // pricelistAll = pricelistAll.filter((row) => {
  //   return moment(row.effdate_to).format('YYYY-MM-DD') >= effdateTo
  // })
  pricelistAll = _.filter(pricelistAll, (item) => item.trd_code !== null && item.trd_code !== undefined && item.trd_code !== '')
  pricelistAll = _.filter(pricelistAll, (item) => item.ret_code !== null && item.ret_code !== undefined && item.ret_code !== '')

  return pricelistAll
}

const isNumeric = (value) => /^\d+$/.test(value)

const trimValue = (data, skipAttributes = []) => {
  if (_.isEmpty(data)) {
    if (typeof data === 'object') {
      return data
    } else if (typeof data === 'string') {
      return ''
    } else {
      return data
    }
  }
  if (Array.isArray(data)) {
    const newArray = data.map((currentValue, index, arr) => {
      if (typeof currentValue === 'object') {
        return trimValue(currentValue, skipAttributes)
      } else if (typeof currentValue === 'string') {
        return currentValue ? currentValue.replace(/\s+/g, '') : currentValue
      } else {
        return currentValue ? currentValue.replace(/\s+/g, '') : currentValue
      }
    })
    return newArray
  } else if (typeof data === 'object') {
    const keys = Object.keys(data)
    if (!keys.length) return data
    const newObject = {}
    keys.map((k) => {
      if (skipAttributes.includes(k)) {
        newObject[k] = data[k]
      } else if (data[k] && typeof data[k] === 'string') {
        if (data[k]) {
          const newData = trimValue(
            data[k].split(' ').filter((arr) => !_.isEmpty(arr)),
            skipAttributes
          )
          newObject[k] = newData.join(' ')
        } else {
          newObject[k] = data[k]
        }
      } else if (data[k] && typeof data[k] === 'object') {
        newObject[k] = trimValue(data[k], skipAttributes)
      } else {
        newObject[k] = data[k]
      }
    })
    return newObject
  } else {
    return data.replace(/\s+/g, '')
  }
}

const cleanEmpty = (obj) => {
  if (Array.isArray(obj)) {
    return obj.map((v) => (v && typeof v === 'object' ? cleanEmpty(v) : v)).filter((v) => !(v == null))
  } else {
    const newObj = Object.entries(obj)
      .map(([k, v]) => [k, v && typeof v === 'object' ? cleanEmpty(v) : v])
      .reduce((a, [k, v]) => (v == null ? a : ((a[k] = v), a)), {})
    // remove empty
    Object.keys(newObj).map((k) => {
      if (newObj[k] === undefined || newObj[k] === '' || newObj[k] === null) {
        delete newObj[k]
      }
    })
    return newObj
  }
}

/**
 * Convert Object to query string.
 * @param {Object} obj
 */
const toQueryString = (params) => {
  if (!params) return ''
  params = cleanEmpty(params)
  if (typeof params === 'object') {
    return `?${decodeURIComponent(qs.stringify(params))}`
  } else if (typeof params === 'string') {
    return params
  }
  return ''
}

exports.updateRetailAndTrader = async (req, res) => {
  let count = 0
  try {
    // const manager = req.app.authManager
    // const userRole = await manager.getRole('User')
    // const traderRole = await manager.getRole('Trader')
    // const retailRole = await manager.getRole('Retail')

    const retCode = req.body.ret_code
    assert(retCode, 400, `invalid ret_code.`)
    const token = req.headers.authorization && req.headers.authorization.split(' ')[1]
    const config = {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      method: 'GET',
    }
    let tsretail = await axios.get(`/ts-retail/item?ret_code=${retCode}`, config)
    assert(tsretail, 400, `ret_code ${retCode} not found.`)

    tsretail = trimValue(tsretail)
    // tsretail = _.get(tsretail, 'data.data', null)

    // ค้นหาข้อมูลตารางราคาล่าสุด
    const effdateTo = _.get(req.body, 'effdate_to', `${moment().format('YYYY')}-12-31`)
    const pyear = _.get(req.body, 'pyear', moment().format('YYYY'))
    const filterPriceList = {
      filter: {
        pyear: pyear,
        effdate_to: {
          '>%3D': effdateTo,
        },
        ret_code: retCode,
        status: 'A',
      },
    }
    let pricelist = await fetchPriceList(config, filterPriceList, effdateTo)

    let filtercontract = {
      pyear: pyear,
      ret_code: retCode,
      effdate_to: {
        '>%3D': effdateTo,
      },
      status: 'A',
      tot_actwgt: {
        '>': 0,
      },
    }
    filtercontract = _.pickBy(filtercontract, (v) => v !== null && v !== undefined && v !== '')
    const filterParamsContract = {
      filter: filtercontract,
    }
    let contractlist = await fetchContracts(config, filterParamsContract)
    // // contractlist = Array.isArray(contractlist) ? contractlist.reverse() : []
    contractlist = _.map(contractlist, (item) =>
      updateObject(item, {
        create_date_unix: parseFloat(moment(item.create_date).format('X')),
      })
    )
    contractlist = _.orderBy(contractlist, ['create_date_unix'], ['desc'])

    const arr = []
    if (contractlist.length) {
      arr.push(_.get(contractlist, '[0]'))
      contractlist = arr
    }
    // // contractlist = _.filter(contractlist, (item) => parseFloat(item.tot_actwgt) > 0)

    let maptrdcodes = _.uniq(_.map(contractlist, 'trd_code'))
    let mapretcodes = _.uniq(_.map(contractlist, 'ret_code'))
    maptrdcodes = maptrdcodes.concat(_.uniq(_.map(pricelist, 'trd_code')))
    mapretcodes = mapretcodes.concat(_.uniq(_.map(pricelist, 'ret_code')))

    const trdcodes = _.uniq(maptrdcodes)
    const retcodes = _.uniq(mapretcodes)
    // // pricelistAll = _.filter(pricelistAll, (item) => maptrdcodes.includes(item.trd_code))
    // pricelistAll = _.concat(pricelistAll, contractlist)

    // let trdcodes = _.uniq(pricelistAll.map((row) => row.trd_code)) // map trd code
    // let retcodes = _.uniq(pricelistAll.map((row) => row.ret_code)) // map ret code

    // trdcodes = _.uniq(trdcodes.concat(maptrdcodes))
    // retcodes = _.uniq(retcodes.concat(mapretcodes))

    // รายชื่อผู้ขายทั้งหมดที่มีในระบบ
    let traders = await fetchTraders(config)
    traders = traders.filter((row) => trdcodes.includes(row.trd_code)) // เอาเฉพาะร้านค้าที่มีใน pricelist

    pricelist = _.uniqBy(pricelist.concat(contractlist), 'trd_code')

    // ลบ field ที่มีค่า null ออก
    tsretail = _.pickBy(tsretail, (v) => v !== null && v !== undefined && v !== '')
    // ลบ field ที่ไม่ต้องการนำเข้าข้อมูลออก
    const retattributes = _.omit(tsretail, [
      'fax',
      'create_by',
      'create_date',
      'change_by',
      'change_date',
      'msrepl_tran_version',
      'RetailGroupID',
    ])

    const retail = updateObject(retattributes, { pricelist: pricelist })
    let modelretail = await TbRet.findOne({ ret_code: retail.ret_code })
    // update
    modelretail = _.omit(modelretail, ['pdpa_agreement'])
    modelretail = updateObject(modelretail, retail)
    const attributes = updateObject(modelretail, {
      ret_id: modelretail.ret_id,
      updated_at: moment().format('YYYY-MM-DD HH:mm:ss'),
      updated_by: modelretail.updated_by,
      ret_status_id: 1,
    })
    const retId = modelretail.ret_id
    // validate
    const values = TbRet.schemas().validateSync(_.pick(attributes, Object.keys(TbRet.attributeLabels())))
    const updated = await new TbRet(values).save()

    for (let i = 0; i < pricelist.length; i++) {
      const price = pricelist[i];
      const trader = _.find(traders, (item) => item.trd_code === price.trd_code)

      const trd = await TbTrd.findOne({ trd_code: trader.trd_code })
      if (trd) {
        const trdConfirm = await TbTrdConfirm.findOne({ trd_id: trd.trd_id, ret_id: retId })
        if (!trdConfirm) {
          const valuesConfirm = TbTrdConfirm.schemas().validateSync({
            trd_id: trd.trd_id,
            ret_id: retId,
            confirm_status: 'Y',
            // created_by: req.user.id,
            // updated_by: req.user.id,
          })
          // save
          await new TbTrdConfirm(valuesConfirm).save()
        } else {
          const valuesConfirm = TbTrdConfirm.schemas().validateSync({
            trd_confirm_id: parseInt(trdConfirm.trd_confirm_id),
            trd_id: trd.trd_id,
            ret_id: retId,
            confirm_status: 'Y',
            // updated_by: req.user.id,
            updated_at: moment().format('YYYY-MM-DD HH:mm:ss'),
          })
          // save
          await new TbTrdConfirm(valuesConfirm).save()
        }
        await TbTrdConfirm.updateRetailNotConfirm(retId, trd.trd_id)
        // update trd
        await new TbTrd({
          trd_id: trd.trd_id,
          trd_status_id: 1,
          updated_at: moment().format('YYYY-MM-DD HH:mm:ss'),
        }).save()
        // unblock user
        if (trd.user_id) {
          await new User({ id: trd.user_id, blocked_at: null }).save()
        }
      } else {
        let attributes = _.omit(trader, [
          'trd_class',
          'eval_grade',
          'create_by',
          'create_date',
          'change_by',
          'change_date',
          'msrepl_tran_version',
        ])
        // set default value
        const email = `trd${String(trader.trd_code).toLowerCase()}@gmail.com` // อีเมลที่เข้าใช้งานระบบ
        const username = `usys${String(trader.trd_code).toLowerCase()}` // ชื่อผู้้ใช่งานที่เขา้สูระบบ
        const password = `psys${String(trader.trd_code).toLowerCase()}` // รหัสผ่านที่เข้าสู่ระบบ

        attributes = updateObject(attributes, {
          // created_by: req.user.id,
          // updated_by: req.user.id,
          created_at: moment().format('YYYY-MM-DD HH:mm:ss'),
          updated_at: moment().format('YYYY-MM-DD HH:mm:ss'),
          trd_status_id: 1,
        })

        // validate
        const values = TbTrd.schemas().validateSync(_.pick(attributes, Object.keys(TbTrd.attributeLabels())))
        // save
        const inserted = await new TbTrd(values).save()
        const trdId = _.get(inserted, '[0]')

        // insert user
        const checkEmail = await User.findByUsernameOrEmail(email)
        // req.assert(!checkEmail, 400, `อีเมลนี้ถูกใช้แล้ว.`)

        const checkUsername = await User.findByUsernameOrEmail(username)
        // req.assert(!checkUsername, 400, `ชื่อผู้ใช้นี้ถูกใช้แล้ว.`)

        if (!checkEmail && !checkUsername) {
          const pwdHash = bcrypt.hashSync(password, 12)
          const time = Math.floor(Date.now() / 1000)
          const userAttr = {
            username: username,
            email: email,
            password_hash: pwdHash,
            auth_key: randomstring.generate(),
            confirmed_at: time,
            registration_ip: req.ip,
            created_at: time,
            updated_at: time,
            flags: 0,
            user_type_id: 3, // ผู้ขาย
          }

          const user = await new User(userAttr).save()
          const userId = user[0]
          await new Profile({ user_id: userId, timezone: 'Asia/Bangkok' }, true).save()

          // update trader
          await new TbTrd(updateObject(values, { user_id: userId, trd_id: trdId })).save()

          // if (userRole) {
          //   await manager.assign(userRole, userId)
          // }
          // if (traderRole) {
          //   await manager.assign(traderRole, userId)
          // }
        } else {
          const userId = _.get(checkEmail, 'id')
          // update trader
          await new TbTrd(updateObject(values, { user_id: userId, trd_id: trdId })).save()
        }

        const trdConfirm = await TbTrdConfirm.findOne({ trd_id: trdId, ret_id: retId })
        if (!trdConfirm) {
          const valuesConfirm = TbTrdConfirm.schemas().validateSync({
            trd_id: trdId,
            ret_id: retId,
            confirm_status: 'Y',
            // created_by: req.user.id,
            // updated_by: req.user.id,
          })
          // save
          await new TbTrdConfirm(valuesConfirm).save()
        } else {
          const valuesConfirm = TbTrdConfirm.schemas().validateSync({
            trd_confirm_id: parseInt(trdConfirm.trd_confirm_id),
            trd_id: trdId,
            ret_id: retId,
            confirm_status: 'Y',
            // updated_by: req.user.id,
            updated_at: moment().format('YYYY-MM-DD HH:mm:ss'),
          })
          // save
          await new TbTrdConfirm(valuesConfirm).save()
        }

        await TbTrdConfirm.updateRetailNotConfirm(retId, trdId)
      }
    }

    res.send({ attributes })
    // // รายชื่อร้านค้า
    // let retails = await axios.get(`/ts-retail/list?filter[ret_code]=${retCode}`, config)
    // retails = trimValue(_.get(retails, 'data.data', []))
    // retails = retails.filter((row) => retcodes.includes(row.ret_code)) // เอาเฉพาะร้านค้าที่มีใน pricelist

    // // let filter = {
    // //   pyear: pyear,
    // //   effdate_to: {
    // //     '>%3D': effdateTo,
    // //   },
    // // }

    // for (let i = 0; i < retails.length; i++) {
    //   // const item = retails[i]
    //   // filter = Object.assign(filter, { ret_code: item.ret_code })
    //   // filter = filter = _.pickBy(filter, (v) => v !== null && v !== undefined && v !== '')

    //   // const filterParamsPrice = {
    //   //   filter: filter,
    //   // }

    //   const resultImport = await importDataFromPriceList(
    //     req,
    //     pricelistAll,
    //     trdcodes,
    //     retcodes,
    //     manager,
    //     userRole,
    //     traderRole,
    //     retailRole,
    //     retails,
    //     traders
    //   )
    //   count = count + _.get(resultImport, 'import_count', 0)
    // }

    // const retail = await TbRet.findOne({ ret_code: retCode })
    // const trdconfirm = await TbTrdConfirm.find()
    //   .where({ ret_id: _.get(retail, 'ret_id', ''), confirm_status: 'Y' })
    //   .orderBy('trd_confirm_id', 'DESC')
    //   .first()
    // const trader = await TbTrd.findOneById(_.get(trdconfirm, 'trd_id', ''))

    // res.success({
    //   message: `นำเข้าข้อมูลสำเร็จ ${count} รายการ`,
    //   count: count,
    //   retails: retails,
    //   traders: traders,
    //   retcodes: retcodes,
    //   trdcodes: trdcodes,
    //   pricelistAll: pricelistAll,
    //   contractlist: contractlist,
    //   tsretail: tsretail,
    //   trader: trader,
    //   retail: retail,
    // })
  } catch (err) {
    res.send(err.message)
  }
}