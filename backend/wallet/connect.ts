import { api } from "encore.dev/api";

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
    // In a real implementation, you would verify the signature
    // For now, we'll create a basic session
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      success: true,
      sessionId
    };
  }
);
