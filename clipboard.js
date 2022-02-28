import os from "os"
import { spawn } from "child_process"
import { Mutex } from "async-mutex"

import History from "./history.js"
import { log, sleep } from "./util.js"

export default class Clipboard {
  constructor({ watchInterval = 1000, historySize = 10 } = {}) {
    [this._read, this._write] = Clipboard.getRwCmds()

    if (historySize < 2) {
      throw new Error("Clipboard: historySize must be greater than or equal to 2")
    }

    this.history = new History(historySize)
    this.mutex = new Mutex()

    this.watchInterval = watchInterval
    this.watchTimeoutId = null
    this.watchHandlers = new Map()
    this.watchHandlers.nextId = 1
  }

  static getRwCmds() {
    switch (os.type()) {
    case "Linux":
      if (process.env.XDG_SESSION_TYPE === "wayland" || (process.env.WAYLAND_DISPLAY ?? "") !== "") {
        log("Linux/Wayland")
        return [
          Clipboard.readWayland,
          Clipboard.writeWayland,
        ]
      }
      if (process.env.XDG_SESSION_TYPE === "x11" || (process.env.DISPLAY ?? "") !== "") {
        log("Linux/X11")
        return [
          Clipboard.readX11,
          Clipboard.writeX11,
        ]
      }
      throw new Error("Unknown/unsupported session type")
    case "Darwin":
      log("macOS")
      return [
        Clipboard.readDarwin,
        Clipboard.writeDarwin,
      ]
    default:
      throw new Error("Unsupported OS")
    }
  }

  static async readWayland() {
    return new Promise((resolve, reject) => {
      const cmd = spawn("wl-paste", ["--no-newline"], {})
      let stdout = ""
      cmd.stdout.on("data", (data) => {
        stdout += `${data}`
      })

      let stderr = ""
      cmd.stderr.on("data", (data) => {
        stderr += `${data}`
      })

      cmd.on("error", (e) => reject(e))
      cmd.on("close", () => resolve([stdout, stderr]))
    })
  }

  static async writeWayland(str) {
    return new Promise((resolve, reject) => {
      const cmd = spawn("wl-copy", [], {})
      cmd.on("spawn", async () => {
        cmd.stdin.end(str)
        resolve()
      })
      cmd.on("error", (e) => reject(e))
    })
  }

  static async readX11() {
    return new Promise((resolve, reject) => {
      const cmd = spawn("xclip", ["-rmlastnl", "-o"], {})
      let stdout = ""
      cmd.stdout.on("data", (data) => {
        stdout += `${data}`
      })

      let stderr = ""
      cmd.stderr.on("data", (data) => {
        stderr += `${data}`
      })

      cmd.on("error", (e) => reject(e))
      cmd.on("close", () => resolve([stdout, stderr]))
    })
  }

  static async writeX11(str) {
    return new Promise((resolve, reject) => {
      const cmd = spawn("xclip", ["-i"], {})
      cmd.on("spawn", () => {
        cmd.stdin.end(str)
        resolve()
      })
      cmd.on("error", (e) => reject(e))
    })
  }

  static async readDarwin() {
    return new Promise((resolve, reject) => {
      const cmd = spawn("pbpaste", [], {})
      let stdout = ""
      cmd.stdout.on("data", (data) => {
        stdout += `${data}`
      })

      let stderr = ""
      cmd.stderr.on("data", (data) => {
        stderr += `${data}`
      })

      cmd.on("error", (e) => reject(e))
      cmd.on("close", () => resolve([stdout, stderr]))
    })
  }

  static async writeDarwin(str) {
    return new Promise((resolve, reject) => {
      const cmd = spawn("pbcopy", [], {})
      cmd.on("spawn", () => {
        cmd.stdin.end(str)
        resolve()
      })
      cmd.on("error", (e) => reject(e))
    })
  }

  get current() {
    return this.history[0]
  }

  get prev() {
    return this.history[1]
  }

  get value() {
    return this.current?.value
  }

  get prevValue() {
    return this.prev?.value
  }

  async write(value, source = "self") {
    return this.mutex.runExclusive(async () => {
      log(`Clipboard.write (${source})\n---\n|${value}|\n---`)
      if (value === this.value) {
        return value
      }
      this.history.push({ action: "write", value, source })
      await this._write(value)
      await sleep(100) // Give the write a few moments to stabilize
      return value
    })
      .catch((e) => { log(`ERROR: write: ${e}`); throw e })
  }

  async read(source = "system") {
    return this.mutex.runExclusive(async () => {
      const [value] = await this._read()
      if (value === this.value) {
        return value
      }
      this.history.push({ action: "read", value, source })
      return value
    })
      .catch((e) => { log(`ERROR: read: ${e}`); throw e })
  }

  _watch() {
    const initial = this.watchTimeoutId === null
    this.watchTimeoutId = setTimeout(async () => {
      const curValue = this.value
      let value
      try {
        value = await this.read()
      } catch (e) {
        log(e)
      }
      if (value !== curValue) {
        for (const h of this.watchHandlers.values()) {
          h(value, this.current)
        }
      }
      this._watch()
    }, initial ? 0 : this.watchInterval)
  }

  watch(handler) {
    if (!this.watchTimeoutId) {
      this._watch()
    }
    const id = this.watchHandlers.nextId
    this.watchHandlers.set(id, handler)
    this.watchHandlers.nextId += 1
    return id
  }

  unwatch(handlerId) {
    if (!this.watchHandlers.delete(handlerId)) {
      throw new Error(`Handler not found: ${handlerId}`)
    }
    if (this.watchHandlers.size === 0) {
      clearInterval(this.watchTimeoutId)
      this.watchTimeoutId = null
    }
  }
}
