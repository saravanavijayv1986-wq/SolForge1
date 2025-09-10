import { api, APIError } from "encore.dev/api";
import { secret } from "encore.dev/config";

const arweaveKey = secret("ArweavePrivateKey");

export interface UploadMetadataRequest {
  name: string;
  symbol: string;
  description?: string;
  image?: string; // Arweave URL for the image
  attributes?: Array<{
    trait_type: string;
    value: string | number;
  }>;
  decimals: number;
  supply: string;
  creator: string;
}

export interface UploadMetadataResponse {
  metadataUrl: string;
  transactionId: string;
}

export interface UploadImageRequest {
  imageData: string; // Base64 encoded image
  fileName: string;
  contentType: string;
}

export interface UploadImageResponse {
  imageUrl: string;
  transactionId: string;
}

// Mock implementation for demonstration - uploads an image to Arweave
export const uploadImage = api<UploadImageRequest, UploadImageResponse>(
  { expose: true, method: "POST", path: "/storage/upload-image" },
  async (req) => {
    try {
      // Validate input
      if (!req.imageData || !req.fileName) {
        throw APIError.invalidArgument("Image data and filename are required");
      }

      // Remove data URL prefix if present
      const base64Data = req.imageData.replace(/^data:image\/[a-z]+;base64,/, '');
      const imageBuffer = Buffer.from(base64Data, 'base64');

      // Validate file size (max 5MB)
      if (imageBuffer.length > 5 * 1024 * 1024) {
        throw APIError.invalidArgument("Image must be smaller than 5MB");
      }

      // Mock Arweave upload - in production this would use the Arweave SDK
      const mockTransactionId = generateMockTransactionId();
      const imageUrl = `https://arweave.net/${mockTransactionId}`;

      // Simulate upload delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      return {
        imageUrl,
        transactionId: mockTransactionId
      };
    } catch (error) {
      console.error("Image upload error:", error);
      
      if (error instanceof APIError) {
        throw error;
      }
      
      throw APIError.internal("An unexpected error occurred during image upload");
    }
  }
);

// Mock implementation for demonstration - uploads token metadata to Arweave
export const uploadMetadata = api<UploadMetadataRequest, UploadMetadataResponse>(
  { expose: true, method: "POST", path: "/storage/upload-metadata" },
  async (req) => {
    try {
      // Create metadata object following token metadata standards
      const metadata = {
        name: req.name,
        symbol: req.symbol,
        description: req.description || "",
        image: req.image || "",
        attributes: req.attributes || [],
        properties: {
          files: req.image ? [
            {
              uri: req.image,
              type: "image/png"
            }
          ] : [],
          category: "image"
        },
        // Additional token-specific metadata
        decimals: req.decimals,
        supply: req.supply,
        creator: req.creator,
        createdAt: new Date().toISOString(),
        platform: "SolForge"
      };

      // Mock Arweave upload - in production this would use the Arweave SDK
      const mockTransactionId = generateMockTransactionId();
      const metadataUrl = `https://arweave.net/${mockTransactionId}`;

      // Simulate upload delay
      await new Promise(resolve => setTimeout(resolve, 1500));

      return {
        metadataUrl,
        transactionId: mockTransactionId
      };
    } catch (error) {
      console.error("Metadata upload error:", error);
      
      if (error instanceof APIError) {
        throw error;
      }
      
      throw APIError.internal("An unexpected error occurred during metadata upload");
    }
  }
);

// Helper function to check Arweave transaction status
export const checkTransactionStatus = api<{ transactionId: string }, { status: string; confirmed: boolean }>(
  { expose: true, method: "GET", path: "/storage/status/:transactionId" },
  async (req) => {
    try {
      // Mock status check - in production this would check actual Arweave status
      const isConfirmed = Math.random() > 0.3; // 70% chance of being confirmed
      
      return {
        status: isConfirmed ? "200" : "202",
        confirmed: isConfirmed
      };
    } catch (error) {
      console.error("Transaction status check error:", error);
      throw APIError.internal("Failed to check transaction status");
    }
  }
);

// Helper function to generate mock transaction IDs
function generateMockTransactionId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
  let result = '';
  for (let i = 0; i < 43; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
