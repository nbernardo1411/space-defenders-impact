import { Capacitor, registerPlugin } from '@capacitor/core'

export type LanRelayStatus = {
  running: boolean
  port: number
  ipAddress: string
  url: string
}

type LanRelayPlugin = {
  start(options?: { port?: number }): Promise<LanRelayStatus>
  stop(): Promise<LanRelayStatus>
  getStatus(): Promise<LanRelayStatus>
}

const NativeLanRelay = registerPlugin<LanRelayPlugin>('LanRelay')

const EMPTY_STATUS: LanRelayStatus = {
  running: false,
  port: 8787,
  ipAddress: '',
  url: '',
}

export function isNativeLanRelayAvailable() {
  return Capacitor.getPlatform() === 'android'
}

export async function startLanRelay(port = 8787): Promise<LanRelayStatus> {
  if (!isNativeLanRelayAvailable()) return EMPTY_STATUS
  return NativeLanRelay.start({ port })
}

export async function stopLanRelay(): Promise<LanRelayStatus> {
  if (!isNativeLanRelayAvailable()) return EMPTY_STATUS
  return NativeLanRelay.stop()
}

export async function getLanRelayStatus(): Promise<LanRelayStatus> {
  if (!isNativeLanRelayAvailable()) return EMPTY_STATUS
  return NativeLanRelay.getStatus()
}
