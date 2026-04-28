declare global {
  namespace Express {
    interface Request {
      requestId: string;
      user?: {
        id: string;
        role: "admin" | "cliente";
        cliente_id: string | null;
        email: string;
      };
    }
  }
}

export {};
