import fs from "fs"
import path, { dirname } from "path"
import https from "https"
import readline from "readline"
import { once } from "events"

import express from "express"
import Conf from "conf"
import meow from "meow"
import yaml from "js-yaml"
import readlinePassword from "@johnls/readline-password"

import Clipboard from "./clipboard.js"
import { log } from "./util.js"

class App {
  constructor() {
    this.schema = {
      listen: {
        type:    "string",
        default: "localhost:47880",
      },
      remote: {
        type: "string",
      },
      password: {
        type: "string",
      },
      name: {
        type:    "string",
        default: "local",
      },
      remote_name: {
        type:    "string",
        default: "remote",
      },
    }
  }

  async init() {
    this.cli = meow(`
  Usage
    $ clipshare [OPTS]

  Options
    --listen    -l  Address and port listen on, of the form [addr][:port].
                    Default: ${this.schema.listen.default}

    --name          Name of the local server
                    Default: ${this.schema.name.default}

    --remote    -r  URL of remote peer to share clipboard with.

    --remote-name   URL of remote peer to share clipboard with.
                    Default: ${this.schema.remote_name.default}

    --password  -P  Password used to authenticate with remote peer.
`, {
      importMeta:     import.meta,
      booleanDefault: undefined,
      autoHelp:       false,
      flags:          {
        help: {
          type:  "boolean",
          alias: "h",
        },
        listen: {
          type:  "string",
          alias: "l",
        },
        remote: {
          type:  "string",
          alias: "r",
        },
        password: {
          type:  "string",
          alias: "p",
        },
        name: {
          type: "string",
        },
        remote_name: {
          type: "string",
        },
      },
    })

    if (this.cli.flags.help) {
      this.cli.showHelp(0)
    }

    this.confFile = new Conf({
      fileExtension: "yml",
      projectName:   "clipshare",
      projectSuffix: "",
      serialize:     yaml.dump,
      deserialize:   yaml.load,
      schema:        this.schema,
    })
    this.conf = { ...this.confFile.store, ...this.cli.flags }
    this.confDir = dirname(this.confFile.path)

    for (const opt of ["listen", "remote"]) {
      if (!this.conf[opt]) {
        process.stderr.write(`Missing option: ${opt}\n`)
        process.exit(1)
      }
    }

    let remote = new URL(this.conf.remote)
    if (!remote.origin || !/^https?:$/.test(remote.protocol)) {
      remote = new URL(`https://${this.conf.remote}`)
    }
    if (remote.protocol !== "https:") {
      process.stderr.write(`Refusing to connect to insecure remote: ${this.conf.remote}\n`)
      process.exit(1)
    }
    this.conf.remote = remote

    if (!this.conf.password && process.stdin.isTTY) {
      const rl = readlinePassword.default.createInstance(process.stdin, process.stdout)
      rl.on("SIGINT", () => process.exit(130))
      this.conf.password = await rl.passwordAsync({ echo: true, prompt: "clipshare password: \u{1F511} " })
      rl.close()
    } else if (this.conf.password === "-") {
      const rl = readline.createInterface({
        input:     process.stdin,
        crlfDelay: Infinity,
      })
      this.conf.password = await once(rl, "line")
    }

    if (!this.conf.password) {
      process.stderr.write("Error: expected password\n")
      process.exit(1)
    }

    this.clipboard = new Clipboard()
    this.server = express()

    this.server.use(
      (req, _, next) => {
        log(req.method, req.url, `[${req.ip}]`)
        next()
      },
      (req, res, next) => {
        if (!req.headers.authorization) {
          log("ERROR: Missing Authorization")
          res.status(401).send()
          return
        }
        if (req.headers.authorization !== this.conf.password) {
          log("ERROR: Invalid Authorization")
          res.status(401).send()
          return
        }
        next()
      },
      express.urlencoded({ extended: true }),
      express.json(),
    )

    this.server.post("/", (req, res) => {
      if (req.body && req.body.data && req.body.data.length > 0) {
        process.stderr.write(`---\n|${req.body.data}|\n---`)
        this.clipboard.write(req.body.data, "remote")
          .catch((e) => log(`ERROR: ${e}`))
      }
      res.status(200).send()
    })
  }

  async start() {
    this.clipboard.watch((value, entry) => {
      log(`Clipboard event (${entry.source})\n---\n|${value}|\n---`)
      if (entry.source === "self" || entry.source === "remote" || (entry.prevValue === value || entry.prevSource === "remote")) {
        log("Skip")
        return
      }
      log(`Remote: POST ${this.conf.remote}`)
      const body = JSON.stringify({ data: value })
      const req = https.request(this.conf.remote, {
        method:  "POST",
        headers: {
          "Content-Type":   "application/json",
          "Content-Length": Buffer.byteLength(body),
          Authorization:    this.conf.password,
        },
        ca:                  [fs.readFileSync(path.join(this.confDir, `certs/${this.conf.remote_name}.pem`))],
        checkServerIdentity: () => null,
      }, (res) => {
        log(`Remote: Response status: ${res.statusCode}`)
      })
      req.on("error", (e) => {
        log(`ERROR: Remote: Request failed: ${e.message}`)
      })
      req.write(body)
      req.end()
    }, 200)

    this.httpsServer = https.createServer({
      key:  fs.readFileSync(path.join(this.confDir, `certs/${this.conf.name}.key`)),
      cert: fs.readFileSync(path.join(this.confDir, `certs/${this.conf.name}.cert`)),
    }, this.server)

    const { hostname, port } = new URL(`https://${this.conf.listen}`)
    this.httpsServer.listen({ hostname, port }, () => {
      log(`Listening on ${this.conf.listen}`)
    })

    await once(this.httpsServer, "close")
  }
}

try {
  const app = new App()
  await app.init()
  await app.start()
} catch (e) {
  process.stdout.write(`${e}\n`)
  process.exit(1)
}
