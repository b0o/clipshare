export const log = (...args) =>
  process.stderr.write(`[${new Date().toISOString()}] ${args.join(" ")}\n`)

export const sleep = (duration) =>
  new Promise((resolve) => setTimeout(() => resolve(), duration))
