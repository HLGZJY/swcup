import { describe, it, expect, vi } from 'vitest'
import { apiNoseCollect, resolveImageUrl } from '@/services/api'

describe('resolveImageUrl', () => {
  it('空值 / undefined / null 返回空串', () => {
    expect(resolveImageUrl('')).toBe('')
    expect(resolveImageUrl(undefined as unknown as string)).toBe('')
    expect(resolveImageUrl(null as unknown as string)).toBe('')
  })

  it('字面 undefined/null 字符串视为空', () => {
    expect(resolveImageUrl('undefined')).toBe('')
    expect(resolveImageUrl('null')).toBe('')
  })

  it('http / https 原样返回', () => {
    expect(resolveImageUrl('http://x.com/a.jpg')).toBe('http://x.com/a.jpg')
    expect(resolveImageUrl('https://x.com/a.jpg')).toBe('https://x.com/a.jpg')
  })

  it('/static/mock/ 原样返回（前端本地静态资源）', () => {
    expect(resolveImageUrl('/static/mock/dog.svg')).toBe('/static/mock/dog.svg')
  })

  it('/static/uploads/ 拼上 BASE_URL（Bug #1 真正根因）', () => {
    const u = resolveImageUrl('/static/uploads/1782872005641_qwrc48hu.jpg')
    expect(u.startsWith('http')).toBe(true)
    expect(u).toContain('/static/uploads/1782872005641_qwrc48hu.jpg')
    expect(u).not.toContain('undefined')
  })
})

describe('apiNoseCollect', () => {
  it('应携带当前用户 token', async () => {
    const requestMock = vi.fn(({ success }) => {
      success({
        statusCode: 201,
        data: { code: 0, message: 'success', data: { vector_id: null } },
      })
    })
    const currentUni = (globalThis as any).uni || {}
    ;(globalThis as any).uni = {
      ...currentUni,
      getStorageSync: vi.fn((key: string) =>
        key === 'token' ? 'token-first-click' : null,
      ),
      request: requestMock,
    }

    await apiNoseCollect({ nose_photo: '', species: 'dog' })

    expect(requestMock).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        data: { nose_photo: '', species: 'dog' },
        header: { Authorization: 'Bearer token-first-click' },
      }),
    )
  })
})
