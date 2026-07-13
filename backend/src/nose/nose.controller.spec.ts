import 'reflect-metadata';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { NoseController } from './nose.controller';

describe('NoseController 鉴权契约', () => {
  it('collect 必须经过 JwtAuthGuard，不得标记为 public', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, NoseController) || [];
    const isPublic = Reflect.getMetadata(
      IS_PUBLIC_KEY,
      NoseController.prototype.collect,
    );

    expect(guards).toContain(JwtAuthGuard);
    expect(isPublic).not.toBe(true);
  });

  it('compare 与 classify 继续保持 public', () => {
    expect(
      Reflect.getMetadata(IS_PUBLIC_KEY, NoseController.prototype.compare),
    ).toBe(true);
    expect(
      Reflect.getMetadata(IS_PUBLIC_KEY, NoseController.prototype.classify),
    ).toBe(true);
  });
});
