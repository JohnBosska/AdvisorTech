// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createBrainGeometry } from './brain'

describe('brain geometry', () => {
  const geo = createBrainGeometry()
  const pos = geo.attributes.position
  it('is normalised to a 2-unit box', () => {
    geo.computeBoundingBox()
    const s = geo.boundingBox!.getSize(new (geo.boundingBox!.min.constructor as new () => { x: number; y: number; z: number })() as never)
    expect(Math.max(s.x, s.y, s.z)).toBeCloseTo(2, 3)
  })
  it('has no brainstem: nothing hangs far below the main mass', () => {
    let below = 0
    for (let i = 0; i < pos.count; i++) if (pos.getY(i) < -0.55) below++
    expect(below / pos.count).toBeLessThan(0.12) // only the cerebellum edge, no stalk
  })
})
