import { readFileSync } from 'fs'
import { resolve } from 'path'
import SwaggerParser from '@apidevtools/swagger-parser'

describe('comments.openapi.yaml', () => {
  it('parses as valid OpenAPI 3.0', async () => {
    const file = resolve(__dirname, 'comments.openapi.yaml')
    const api = await SwaggerParser.validate(file as any)
    expect(api.openapi).toMatch(/^3\.0\./)
  })
  it('exposes POST /v1/comments', async () => {
    const file = resolve(__dirname, 'comments.openapi.yaml')
    const api: any = await SwaggerParser.dereference(file as any)
    expect(api.paths['/v1/comments'].post).toBeDefined()
  })
  it('exposes GET /v1/comments/animal/{animal_id}/summary', async () => {
    const file = resolve(__dirname, 'comments.openapi.yaml')
    const api: any = await SwaggerParser.dereference(file as any)
    expect(api.paths['/v1/comments/animal/{animal_id}/summary'].get).toBeDefined()
  })
})