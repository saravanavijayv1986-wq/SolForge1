import { api, APIError } from "encore.dev/api";
import { secret } from "encore.dev/config";
import Arweave from "arweave";

const arweaveKey = secret("ArweavePrivateKey");

// Initialize Arweave
const arweave = Arweave.init({
  host: 'arweave.net',
  port: 443,
  protocol: 'https'
});

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

// Uploads an image to Arweave
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

      // Get wallet from private key
      const key = JSON.parse(arweaveKey());
      
      // Create transaction for image upload
      const transaction = await arweave.createTransaction({
        data: imageBuffer
      }, key);

      // Add tags
      transaction.addTag('Content-Type', req.contentType || 'image/png');
      transaction.addTag('App-Name', 'SolForge');
      transaction.addTag('File-Name', req.fileName);
      transaction.addTag('Type', 'image');

      // Sign and submit transaction
      await arweave.transactions.sign(transaction, key);
      const response = await arweave.transactions.post(transaction);

      if (response.status !== 200) {
        throw APIError.internal(`Arweave upload failed with status ${response.status}`);
      }

      const imageUrl = `https://arweave.net/${transaction.id}`;

      return {
        imageUrl,
        transactionId: transaction.id
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

// Uploads token metadata to Arweave
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

      const metadataBuffer = Buffer.from(JSON.stringify(metadata, null, 2));

      // Get wallet from private key
      const key = JSON.parse(arweaveKey());
      
      // Create transaction for metadata upload
      const transaction = await arweave.createTransaction({
        data: metadataBuffer
      }, key);

      // Add tags
      transaction.addTag('Content-Type', 'application/json');
      transaction.addTag('App-Name', 'SolForge');
      transaction.addTag('Type', 'metadata');
      transaction.addTag('Token-Symbol', req.symbol);
      transaction.addTag('Token-Name', req.name);

      // Sign and submit transaction
      await arweave.transactions.sign(transaction, key);
      const response = await arweave.transactions.post(transaction);

      if (response.status !== 200) {
        throw APIError.internal(`Arweave upload failed with status ${response.status}`);
      }

      const metadataUrl = `https://arweave.net/${transaction.id}`;

      return {
        metadataUrl,
        transactionId: transaction.id
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
      const status = await arweave.transactions.getStatus(req.transactionId);
      
      return {
        status: status.status.toString(),
        confirmed: status.confirmed !== null
      };
    } catch (error) {
      console.error("Transaction status check error:", error);
      throw APIError.internal("Failed to check transaction status");
    }
  }
);
