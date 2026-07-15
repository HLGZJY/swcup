import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { CollectNoseDto } from './nose.dto'

describe('CollectNoseDto (2026-07-14 bug4 三属性透传)', () => {
  it('合法 junior/healthy/true 通过', async () => {
    const dto = plainToInstance(CollectNoseDto, {
      species: 'dog',
      age_estimate: 'junior',
      health_status: 'healthy',
      sterilized: true,
    })
    const errs = await validate(dto)
    expect(errs).toEqual([])
  })

  it('age_estimate 接受 junior|adult|senior|unknown', async () => {
    for (const v of ['junior', 'adult', 'senior', 'unknown']) {
      const dto = plainToInstance(CollectNoseDto, { age_estimate: v })
      const errs = await validate(dto)
      expect(errs).toEqual([])
    }
  })

  it('age_estimate 拒绝 puppy (后端 CreateAnimalDto 兼容 puppy,但 collect 端不混用)', async () => {
    const dto = plainToInstance(CollectNoseDto, { age_estimate: 'puppy' })
    const errs = await validate(dto)
    expect(errs.length).toBeGreaterThan(0)
  })

  it('health_status 接受 sick', async () => {
    const dto = plainToInstance(CollectNoseDto, { health_status: 'sick' })
    const errs = await validate(dto)
    expect(errs).toEqual([])
  })

  it('sterilized 接受 true|false|null|undefined', async () => {
    for (const v of [true, false, null, undefined]) {
      const dto = plainToInstance(CollectNoseDto, { sterilized: v })
      const errs = await validate(dto)
      expect(errs).toEqual([])
    }
  })
})
