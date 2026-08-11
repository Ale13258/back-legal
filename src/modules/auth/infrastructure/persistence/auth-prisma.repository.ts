import { prisma } from "../../../../shared/infrastructure/prisma/prisma.client.js";
import { getIdleCutoffDate } from "../../../../shared/security/session-policy.js";
import type {
  AuthPersistencePort,
  ActiveRefreshToken,
  ActivateStaffByInvitationInput,
  ActivateStaffByInvitationResult,
  AuthUserPayload,
  RegistrationInvitation,
} from "../../domain/ports/auth-persistence.port.js";

export class AuthPrismaRepository implements AuthPersistencePort {
  findUserByEmail(email: string) {
    return prisma.usuario.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        role: true,
        cliente_id: true,
        password_hash: true,
        is_active: true,
        activated_at: true,
      },
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
        is_active: true,
        activated_at: new Date(),
        activation_token_hash: null,
        activation_expires_at: null,
      },
    });

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      cliente_id: user.cliente_id,
    };
  }

  async findValidRegistrationInvitation(
    activation_token_hash: string,
    now: Date,
  ): Promise<RegistrationInvitation | null> {
    const user = await prisma.usuario.findFirst({
      where: {
        activation_token_hash,
        activated_at: null,
        password_hash: null,
        is_active: false,
        activation_expires_at: { gt: now },
        OR: [
          {
            role: { in: ["analista_legal", "abogada_junior"] },
            cliente_id: null,
          },
          {
            role: "cliente",
            cliente_id: { not: null },
          },
        ],
      },
      select: {
        email: true,
        role: true,
        activation_expires_at: true,
      },
    });

    if (
      !user ||
      user.activation_expires_at == null ||
      (user.role !== "analista_legal" &&
        user.role !== "abogada_junior" &&
        user.role !== "cliente")
    ) {
      return null;
    }

    return {
      email: user.email,
      role: user.role,
      expires_at: user.activation_expires_at,
    };
  }

  async activateStaffByInvitation(
    input: ActivateStaffByInvitationInput,
  ): Promise<ActivateStaffByInvitationResult | null> {
    return prisma.$transaction(async (tx) => {
      const candidate = await tx.usuario.findFirst({
        where: {
          activation_token_hash: input.activation_token_hash,
          activated_at: null,
          password_hash: null,
          is_active: false,
          activation_expires_at: { gt: input.now },
          OR: [
            {
              role: { in: ["analista_legal", "abogada_junior"] },
              cliente_id: null,
            },
            {
              role: "cliente",
              cliente_id: { not: null },
            },
          ],
        },
        select: {
          id: true,
          email: true,
          role: true,
        },
      });

      if (
        !candidate ||
        (candidate.role !== "analista_legal" &&
          candidate.role !== "abogada_junior" &&
          candidate.role !== "cliente")
      ) {
        return null;
      }

      // Compare-and-set: solo una activación concurrente puede ganar.
      const updated = await tx.usuario.updateMany({
        where: {
          id: candidate.id,
          activation_token_hash: input.activation_token_hash,
          activated_at: null,
          password_hash: null,
          is_active: false,
        },
        data: {
          password_hash: input.password_hash,
          activated_at: input.now,
          is_active: true,
          activation_token_hash: null,
          activation_expires_at: null,
        },
      });

      if (updated.count !== 1) {
        return null;
      }

      return {
        id: candidate.id,
        email: candidate.email,
        role: candidate.role,
      };
    });
  }

  createRefreshToken(input: {
    usuario_id: string;
    token_hash: string;
    expires_at: Date;
    session_expires_at: Date;
    last_used_at: Date;
  }) {
    return prisma.refreshToken.create({
      data: {
        usuario_id: input.usuario_id,
        token_hash: input.token_hash,
        expires_at: input.expires_at,
        session_expires_at: input.session_expires_at,
        last_used_at: input.last_used_at,
      },
      select: { id: true },
    });
  }

  findActiveRefreshToken(input: {
    usuario_id: string;
    token_hash: string;
  }): Promise<ActiveRefreshToken | null> {
    const now = new Date();
    return prisma.refreshToken.findFirst({
      where: {
        usuario_id: input.usuario_id,
        token_hash: input.token_hash,
        revoked_at: null,
        expires_at: { gt: now },
        session_expires_at: { gt: now },
        last_used_at: { gt: getIdleCutoffDate(now) },
      },
    });
  }

  async rotateRefreshToken(input: {
    existingRefreshTokenId: string;
    usuario_id: string;
    newTokenHash: string;
    newExpiresAt: Date;
    session_expires_at: Date;
    last_used_at: Date;
  }): Promise<{ newRefreshTokenId: string }> {
    return prisma.$transaction(async (tx) => {
      const newToken = await tx.refreshToken.create({
        data: {
          usuario_id: input.usuario_id,
          token_hash: input.newTokenHash,
          expires_at: input.newExpiresAt,
          session_expires_at: input.session_expires_at,
          last_used_at: input.last_used_at,
        },
        select: { id: true },
      });

      await tx.refreshToken.update({
        where: { id: input.existingRefreshTokenId },
        data: {
          revoked_at: new Date(),
          replaced_by_token_id: newToken.id,
        },
      });

      return { newRefreshTokenId: newToken.id };
    });
  }

  async touchRefreshTokenLastUsed(input: { id: string; last_used_at: Date }): Promise<void> {
    await prisma.refreshToken.update({
      where: { id: input.id },
      data: { last_used_at: input.last_used_at },
    });
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
