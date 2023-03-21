const _ = require('lodash')
const yup = require('yup')
const db = require('../../core/config/mysql')

class Profile {
  constructor(attributes = {}, isNewRecord = false) {
    this.attributes = attributes
    this.tableName = 'profile'
    this.db = db
    this.isNewRecord = isNewRecord
  }

  static schemas() {
    return yup.object().shape({
      user_id: yup.number().integer().required(),
      name: yup.string().notRequired(),
      public_email: yup.string().email().notRequired(),
      gravatar_email: yup.string().email().notRequired(),
      gravatar_id: yup.string().notRequired(),
      location: yup.string().notRequired(),
      website: yup.string().url().notRequired(),
      bio: yup.string().notRequired(),
      timezone: yup.string().notRequired(),
      firstname: yup.string().notRequired(),
      lastname: yup.string().notRequired(),
      picture_base_url: yup.string().notRequired(),
      picture_path: yup.string().notRequired(),
      tel: yup.string().notRequired(),
    })
  }

  save() {
    if (!this.attributes) throw new Error('profile not set.')

    if (_.get(this.attributes, 'user_id') && !this.isNewRecord) {
      return this.db(this.tableName)
        .where('user_id', this.attributes.user_id)
        .update(_.omit(this.attributes, ['user_id']))
    } else {
      // new record
      return this.db(this.tableName).insert(this.attributes)
    }
  }

  static find() {
    return this.db.select('*').from(this.tableName)
  }

  static findById = (userId) => {
    return this.find().where('user_id', userId).first()
  }

  static deleteById(userId) {
    return this.db(this.tableName).where('user_id', userId).del()
  }

  static deleteByIds(userIds) {
    return this.db(this.tableName).whereIn('user_id', userIds).del()
  }
}

Profile.db = db
Profile.tableName = 'profile'

module.exports = Profile
