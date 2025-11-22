import { useMemo } from 'react'
import { BufferGeometry, Float32BufferAttribute } from 'three'

interface GridOverlayProps {
  width?: number
  height?: number
  divisions?: { horizontal: number; vertical: number }
  subdivisions?: number
  color?: string
  opacity?: number
}

export function GridOverlay({
  width = 8,
  height = 6,
  divisions = { horizontal: 8, vertical: 10 },
  subdivisions = 5,
  color = '#00ff00',
  opacity = 0.3,
}: GridOverlayProps) {
  const { mainGridGeometry, subGridGeometry, centerCrosshairGeometry } = useMemo(() => {
    const mainPositions: number[] = []
    const subPositions: number[] = []
    const centerPositions: number[] = []

    const stepX = width / divisions.vertical
    const stepY = height / divisions.horizontal

    // Vertical lines
    for (let i = 0; i <= divisions.vertical; i++) {
      const x = -width / 2 + i * stepX
      const isCenter = Math.abs(x) < 0.001

      if (isCenter) {
        centerPositions.push(x, -height / 2, 0.01)
        centerPositions.push(x, height / 2, 0.01)
      } else {
        mainPositions.push(x, -height / 2, 0.01)
        mainPositions.push(x, height / 2, 0.01)
      }
    }

    // Horizontal lines
    for (let i = 0; i <= divisions.horizontal; i++) {
      const y = -height / 2 + i * stepY
      const isCenter = Math.abs(y) < 0.001

      if (isCenter) {
        centerPositions.push(-width / 2, y, 0.01)
        centerPositions.push(width / 2, y, 0.01)
      } else {
        mainPositions.push(-width / 2, y, 0.01)
        mainPositions.push(width / 2, y, 0.01)
      }
    }

    // Subdivisions (Ticks) on Center Axes
    const tickSize = Math.min(stepX, stepY) * 0.15

    // Ticks along Center Horizontal Axis (y=0)
    for (let i = 0; i < divisions.vertical; i++) {
      const startX = -width / 2 + i * stepX
      const subStep = stepX / subdivisions

      for (let j = 1; j < subdivisions; j++) {
        const x = startX + j * subStep
        subPositions.push(x, -tickSize / 2, 0.01)
        subPositions.push(x, tickSize / 2, 0.01)
      }
    }

    // Ticks along Center Vertical Axis (x=0)
    for (let i = 0; i < divisions.horizontal; i++) {
      const startY = -height / 2 + i * stepY
      const subStep = stepY / subdivisions

      for (let j = 1; j < subdivisions; j++) {
        const y = startY + j * subStep
        subPositions.push(-tickSize / 2, y, 0.01)
        subPositions.push(tickSize / 2, y, 0.01)
      }
    }

    const mainGeo = new BufferGeometry()
    mainGeo.setAttribute('position', new Float32BufferAttribute(mainPositions, 3))

    const subGeo = new BufferGeometry()
    subGeo.setAttribute('position', new Float32BufferAttribute(subPositions, 3))

    const centerGeo = new BufferGeometry()
    centerGeo.setAttribute('position', new Float32BufferAttribute(centerPositions, 3))

    return { mainGridGeometry: mainGeo, subGridGeometry: subGeo, centerCrosshairGeometry: centerGeo }
  }, [width, height, divisions, subdivisions])

  return (
    <group>
      {/* Main Grid */}
      <lineSegments geometry={mainGridGeometry}>
        <lineBasicMaterial color={color} transparent opacity={opacity} />
      </lineSegments>

      {/* Center Crosshair - slightly more opaque */}
      <lineSegments geometry={centerCrosshairGeometry}>
        <lineBasicMaterial color={color} transparent opacity={opacity * 1.5} />
      </lineSegments>

      {/* Subdivisions - same as center or slightly less */}
      <lineSegments geometry={subGridGeometry}>
        <lineBasicMaterial color={color} transparent opacity={opacity * 1.2} />
      </lineSegments>
    </group>
  )
}
