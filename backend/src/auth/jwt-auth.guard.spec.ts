import { describe, it, expect } from 'vitest';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AuthGuard } from '@nestjs/passport';

describe('JwtAuthGuard', () => {
  it('should be defined and extend AuthGuard("jwt")', () => {
    const guard = new JwtAuthGuard();
    expect(guard).toBeDefined();
    expect(guard).toBeInstanceOf(AuthGuard('jwt'));
  });
});
