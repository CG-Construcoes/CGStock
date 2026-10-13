import { describe, expect, it } from "vitest"
import { detectInstallPlatform } from "@/lib/install-platform"

describe("install instructions by device", () => {
  it("detects iPhone Safari", () => {
    expect(detectInstallPlatform("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1")).toBe("ios-safari")
  })

  it("directs iOS Chrome users to Safari", () => {
    expect(detectInstallPlatform("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 CriOS/123 Mobile/15E148 Safari/604.1")).toBe("ios-other")
  })

  it("recognizes iPads with desktop-style user agents", () => {
    expect(detectInstallPlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit/605.1.15 Safari/605.1.15", "MacIntel", 5)).toBe("ios-safari")
  })

  it("detects Android and ignores desktop", () => {
    expect(detectInstallPlatform("Mozilla/5.0 (Linux; Android 15; Pixel) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36")).toBe("android")
    expect(detectInstallPlatform("Mozilla/5.0 (X11; Linux x86_64) Chrome/130 Safari/537.36")).toBe("other")
  })
})
