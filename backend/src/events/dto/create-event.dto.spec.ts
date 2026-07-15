import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { CreateEventDto } from './create-event.dto'

describe('CreateEventDto (2026-07-14 三属性 + 报告页 enum 对齐)', () => {
  it('age_estimate=junior / health_status=healthy / sterilized=true 全部合法', async () => {
    const dto = plainToInstance(CreateEventDto, {
      event_type: 'report',
      species: 'dog',
      age_estimate: 'junior',
      health_status: 'healthy',
      sterilized: true,
    })
    expect(await validate(dto)).toEqual([])
  })

  it('age_estimate 仍接受 puppy (向后兼容)', async () => {
    const dto = plainToInstance(CreateEventDto, {
      event_type: 'report', species: 'dog', age_estimate: 'puppy',
    })
    expect(await validate(dto)).toEqual([])
  })

  it('health_status 接受 sick', async () => {
    const dto = plainToInstance(CreateEventDto, {
      event_type: 'report', species: 'dog', health_status: 'sick',
    })
    expect(await validate(dto)).toEqual([])
  })
})
