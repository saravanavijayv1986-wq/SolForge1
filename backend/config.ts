import { secret } from "encore.dev/config";

const adminWalletSecret = secret("AdminWalletAddress");

const FALLBACK_ADMIN_WALLET = "315bW7FbJXyHbYq5ZWJg1TYXinANZqVujzpkiG1LtQji";

export function getAdminWallet(): string {
  try {
    return adminWalletSecret();
  } catch (error) {
    const envWallet = process.env.ADMIN_WALLET_ADDRESS;
    if (envWallet && envWallet.length > 0) {
      return envWallet;
    }
    console.warn("Admin wallet secret not configured; using fallback wallet address. This is insecure for production.");
    return FALLBACK_ADMIN_WALLET;
  }
}
