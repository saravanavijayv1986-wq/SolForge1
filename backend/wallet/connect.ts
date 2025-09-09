import { api, APIError } from "encore.dev/api";
import bs58 from "bs58";
import { ed25519 } from "@noble/curves/ed25519";

export interface WalletConnectRequest {
  publicKey: string;
  signature: string;
  timestamp: number;
}

export interface WalletConnectResponse {
  success: boolean;
  sessionId: string;
}

// Validates wallet connection and creates session
export const connect = api<WalletConnectRequest, WalletConnectResponse>(
  { expose: true, method: "POST", path: "/wallet/connect" },
  async (req) => {
    const now = Date.now();
    if (Math.abs(now - req.timestamp) > 5 * 60 * 1000) {
      throw APIError.invalidArgument("Signature timestamp is too far from current time");
    }

    try {
      const message = new TextEncoder().encode(`connect:${req.timestamp}`);
      const publicKeyBytes = bs58.decode(req.publicKey);
      const signatureBytes = bs58.decode(req.signature);

      const verified = ed25519.verify(signatureBytes, message, publicKeyBytes);
      if (!verified) {
        throw APIError.permissionDenied("Invalid wallet signature");
      }
    } catch (err) {
      if (err instanceof APIError) throw err;
      throw APIError.invalidArgument("Failed to verify wallet signature");
    }

    const sessionId = `session_${now}_${Math.random().toString(36).substr(2, 9)}`;
    return { success: true, sessionId };
  }
);
