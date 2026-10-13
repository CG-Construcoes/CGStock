export type InstallPlatform = "ios-safari" | "ios-other" | "android" | "other"

export function detectInstallPlatform(userAgent: string, platform = "", touchPoints = 0): InstallPlatform {
  const ios = /iPad|iPhone|iPod/.test(userAgent) || (platform === "MacIntel" && touchPoints > 1)
  if (ios) return /Safari/.test(userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(userAgent) ? "ios-safari" : "ios-other"
  if (/Android/.test(userAgent)) return "android"
  return "other"
}
