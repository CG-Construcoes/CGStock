import { describe, expect, it } from "vitest"
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

const publicDir = resolve(process.cwd(), "public")
const manifest = JSON.parse(readFileSync(resolve(publicDir, "manifest.json"), "utf8")) as {
  start_url: string
  scope: string
  display: string
  icons: { src: string; sizes: string; type: string; purpose?: string }[]
}

describe("PWA manifest", () => {
  it("uses a same-origin standalone entry", () => {
    expect(manifest.start_url).toBe("/")
    expect(manifest.scope).toBe("/")
    expect(manifest.display).toBe("standalone")
  })

  it("does not precache authenticated pages or APIs in production builds", () => {
    if (!existsSync(resolve(publicDir, "sw.js"))) return
    const sw = readFileSync(resolve(publicDir, "sw.js"), "utf8")
    expect(sw).not.toMatch(/\{url:"\/(?:api\/|login|dashboard|stock|products)/)
  })

  it("provides actual PNG icons with matching dimensions", () => {
    for (const icon of manifest.icons) {
      expect(icon.type).toBe("image/png")
      const bytes = readFileSync(resolve(publicDir, icon.src.slice(1)))
      expect(bytes.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a")
      const [width, height] = icon.sizes.split("x").map(Number)
      expect(bytes.readUInt32BE(16)).toBe(width)
      expect(bytes.readUInt32BE(20)).toBe(height)
    }
    expect(manifest.icons.some(icon => icon.purpose === "maskable")).toBe(true)
  })
})
