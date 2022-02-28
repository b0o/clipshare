import { log } from "./util.js"

export default class History extends Array {
  constructor(cap, ...args) {
    super(...args)
    this.cap = cap
  }

  push(val) {
    Object.assign(val, { timestamp: new Date() })
    log(`History push: ${JSON.stringify(val)}`)
    this.unshift(val)
    if (this.length > this.cap) {
      this.pop()
    }
    return this
  }
}
