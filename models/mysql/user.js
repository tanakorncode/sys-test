const _ = require('lodash')
const bcrypt = require('bcrypt')
const createError = require('http-errors')
const db = require('../../core/config/mysql')
const utils = require('../../utils')
// const createBlackList = require('../../core/auth/jwt-blacklist')

class User {
  constructor(attributes = {}) {
    this.attributes = attributes
    this.db = db
    this.tableName = 'user'
  }

  save() {
    if (!this.attributes) throw new Error('user not set.')

    const time = Math.floor(Date.now() / 1000)
    this.attributes = Object.assign(this.attributes, { updated_at: time })

    if (_.get(this.attributes, 'id')) {
      return this.db(this.tableName)
        .where('id', this.attributes.id)
        .update(_.omit(this.attributes, ['id']))
    } else {
      // new record
      this.attributes = Object.assign(this.attributes, { created_at: time })
      return this.db(this.tableName).insert(_.omit(this.attributes, ['id']))
    }
  }

  static count() {
    return this.db('user').count('id', { as: 'total' })
  }

  static find() {
    return this.db
      .select(['user.*', 'profile.*', 'user_type.type_name'])
      .from(this.tableName)
      .innerJoin('profile', 'profile.user_id', 'user.id')
      .leftJoin('user_type', 'user_type.user_type_id', 'user.user_type_id')
  }

  static findById(userId) {
    return this.find().where('user.id', userId).first()
  }

  static findByUsername(username) {
    return this.find().where('user.username', username).first()
  }

  static findByEmail(email) {
    return this.find().where('user.email', email).first()
  }

  static findByUsernameOrEmail(usernameOrEmail) {
    const isEmail = new RegExp('^(.+)@(.+).(.+)$', 'i').test(usernameOrEmail)
    if (isEmail) {
      return this.findByEmail(usernameOrEmail)
    }
    return this.findByUsername(usernameOrEmail)
  }

  static findByCondition(codition) {
    const query = this.find()
    return query.andWhere(codition)
  }

  static deleteById(userId) {
    return this.db(this.tableName).where('id', userId).del()
  }

  static deleteAll(condition = null) {
    if (condition) {
      return this.db(this.tableName).where(condition).del()
    }
    return this.db(this.tableName).del()
  }

  static deleteByIds(userIds) {
    return this.db(this.tableName).whereIn('id', userIds).del()
  }

  profile() {
    return this.db.select('*').from('profile').where('user_id', this.id).first()
  }

  static populateItem(attributes) {
    return new User(attributes)
  }

  get getId() {
    return _.get(this.attributes, 'id', null)
  }

  get id() {
    return _.get(this.attributes, 'id', null)
  }

  static async login(username, password) {
    try {
      const blacklist = await createBlackList()
      // check user
      const user = await this.findByUsernameOrEmail(username)
      if (!user) throw createError(400, 'incorrect username or password.')

      const isBlocked = user.blocked_at !== null
      if (isBlocked) {
        throw createError(400, 'Your account has been blocked.')
      }

      // check password
      const isPwdMatch = bcrypt.compareSync(password, user.password_hash)
      if (!isPwdMatch) throw createError(400, 'incorrect username or password.')

      // update user
      const time = Math.floor(Date.now() / 1000)

      const payload = {
        user: _.pick(user, ['id', 'username', 'name']),
        name: user.name,
        jti: user.id,
      }
      // is token not expire
      if (user.token_expire && user.access_token && user.token_expire > time) {
        const model = new User({ id: user.id, last_login_at: time })
        await model.save()
        return {
          access_token: user.access_token,
          expires_in: user.token_expire,
          token_type: process.env.TOKEN_TYPE,
          user,
        }
      } else {
        const hasToken = await blacklist.has(user.access_token)
        if (!hasToken) {
          await blacklist.add(user.access_token)
        }
      }
      // create new token
      const token = utils.generateAccessToken(payload)
      const decoded = utils.verifyToken(token)
      const model = new User({ id: user.id, last_login_at: time, access_token: token, token_expire: decoded.exp })
      await model.save()
      return { access_token: token, expires_in: decoded.exp, token_type: process.env.TOKEN_TYPE, user }
    } catch (err) {
      throw err
    }
  }

  static findAllUserTypes() {
    return this.db.select('*').from('user_type')
  }
}

User.db = db

User.tableName = 'user'

module.exports = User
