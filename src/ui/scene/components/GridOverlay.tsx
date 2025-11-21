import { useMemo } from 'react'
import { BufferGeometry, Float32BufferAttribute } from 'three'

interface GridOverlayProps {
  width?: number
  height?: number
  divisions?: { horizontal: number; vertical: number }
  color?: string
  opacity?: number
}

export function GridOverlay({
  width = 8,
  height = 6,
  divisions = { horizontal: 8, vertical: 10 },
  color = '#00ff00',
  opacity = 0.3,
}: GridOverlayProps) {
  const gridGeometry = useMemo(() => {
    const geometry = new BufferGeometry()
    const positions: number[] = []

    const stepX = width / divisions.vertical
    const stepY = height / divisions.horizontal

    // Vertical lines (time divisions)
    for (let i = 0; i <= divisions.vertical; i++) {
      const x = -width / 2 + i * stepX
      positions.push(x, -height / 2, 0.01)
      positions.push(x, height / 2, 0.01)
    }

    // Horizontal lines (voltage divisions)
    for (let i = 0; i <= divisions.horizontal; i++) {
      const y = -height / 2 + i * stepY
      positions.push(-width / 2, y, 0.01)
      positions.push(width / 2, y, 0.01)
    }

    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
    return geometry
  }, [width, height, divisions])

  return (
    <lineSegments geometry={gridGeometry}>
      <lineBasicMaterial color={color} transparent opacity={opacity} />
    </lineSegments>
  )
}
