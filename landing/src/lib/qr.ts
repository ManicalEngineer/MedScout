import QRCode from 'qrcode'
import { QR_TARGET_URL } from './stores'

/** QR code as an inline SVG string. Called from server components, so it is
 *  generated at build time and ships no QR library to the browser. */
export async function getQrSvg(): Promise<string> {
  return QRCode.toString(QR_TARGET_URL, {
    type: 'svg',
    margin: 1,
    errorCorrectionLevel: 'M',
    color: { dark: '#0D1117', light: '#FFFFFF' },
  })
}
