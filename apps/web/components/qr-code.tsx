'use client'

import { useCallback, useRef } from 'react'
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react'
import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'

interface QrCodeProps {
  value: string
  slug: string
  size?: number
}

const DOWNLOAD_SIZE = 1024

export function QrCode({ value, slug, size = 256 }: QrCodeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const downloadPng = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `lynx-${slug}-qr.png`
      a.click()
      URL.revokeObjectURL(url)
    }, 'image/png')
  }, [slug])

  const downloadSvg = useCallback(() => {
    const svgEl = document.querySelector(`#qr-svg-${slug}`) as SVGSVGElement | null
    if (!svgEl) return
    const serializer = new XMLSerializer()
    const svgString = serializer.serializeToString(svgEl)
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `lynx-${slug}-qr.svg`
    a.click()
    URL.revokeObjectURL(url)
  }, [slug])

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="rounded-lg border bg-white p-4">
        <QRCodeSVG
          id={`qr-svg-${slug}`}
          value={value}
          size={size}
          level="H"
          includeMargin
        />
      </div>
      <QRCodeCanvas
        ref={canvasRef}
        value={value}
        size={DOWNLOAD_SIZE}
        level="H"
        includeMargin
        className="hidden"
      />
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={downloadPng}>
          <Download className="mr-1 h-3 w-3" />
          PNG
        </Button>
        <Button variant="outline" size="sm" onClick={downloadSvg}>
          <Download className="mr-1 h-3 w-3" />
          SVG
        </Button>
      </div>
    </div>
  )
}
