import { prisma } from "../../../../shared/infrastructure/prisma/prisma.client.js";
import type {
  AuthPersistencePort,
  ActiveRefreshToken,
  AuthUserPayload,
} from "../../domain/ports/auth-persistence.port.js";

export class AuthPrismaRepository implements AuthPersistencePort {
  findUserByEmail(email: string) {
    return prisma.usuario.findUnique({
      where: { email },
    });
  }

  findClienteByEmail(email: string) {
    return prisma.cliente.findUnique({
      where: { email },
    });
  }

  async createUserForCliente(input: {
    email: string;
    password_hash: string;
    role: "cliente";
    cliente_id: string;
  }): Promise<AuthUserPayload> {
    const user = await prisma.usuario.create({
      data: {
        email: input.email,
        password_hash: input.password_hash,
        role: input.role,
        cliente_id: input.cliente_id,
      },
    });

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      cliente_id: user.cliente_id,
    };
  }

  createRefreshToken(input: {
    usuario_id: string;
    token_hash: string;
    expires_at: Date;
  }) {
    return prisma.refreshToken.create({
      data: {
        usuario_id: input.usuario_id,
        token_hash: input.token_hash,
        expires_at: input.expires_at,
      },
      select: { id: true },
    });
  }

  findActiveRefreshToken(input: {
    usuario_id: string;
    token_hash: string;
  }): Promise<ActiveRefreshToken | null> {
    return prisma.refreshToken.findFirst({
      where: {
        usuario_id: input.usuario_id,
        token_hash: input.token_hash,
        revoked_at: null,
      },
    });
  }

  async rotateRefreshToken(input: {
    existingRefreshTokenId: string;
    usuario_id: string;
    newTokenHash: string;
    newExpiresAt: Date;
  }): Promise<void> {
    await prisma.$transaction([
      prisma.refreshToken.update({
        where: { id: input.existingRefreshTokenId },
        data: { revoked_at: new Date() },
      }),
      prisma.refreshToken.create({
        data: {
          usuario_id: input.usuario_id,
          token_hash: input.newTokenHash,
          expires_at: input.newExpiresAt,
        },
      }),
    ]);
  }

  async revokeRefreshTokens(input: { usuario_id: string; token_hash: string }): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: {
        usuario_id: input.usuario_id,
        token_hash: input.token_hash,
        revoked_at: null,
      },
      data: { revoked_at: new Date() },
    });
  }
}

