import { APIError } from "encore.dev/api";
import { VALIDATION_RULES } from "../config/app";

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export class ValidationError extends Error {
  public field: string;
  public code: string;

  constructor(field: string, message: string, code: string = 'VALIDATION_ERROR') {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
    this.code = code;
  }
}

export class InputValidator {
  private errors: ValidationError[] = [];

  // Token name validation
  validateTokenName(name: string, required: boolean = true): this {
    if (!name && required) {
      this.addError('name', 'Token name is required', 'REQUIRED');
      return this;
    }

    if (name) {
      const trimmed = name.trim();
      if (trimmed.length < VALIDATION_RULES.tokenName.minLength) {
        this.addError('name', `Token name must be at least ${VALIDATION_RULES.tokenName.minLength} character`, 'MIN_LENGTH');
      }
      if (trimmed.length > VALIDATION_RULES.tokenName.maxLength) {
        this.addError('name', `Token name must not exceed ${VALIDATION_RULES.tokenName.maxLength} characters`, 'MAX_LENGTH');
      }
      if (!VALIDATION_RULES.tokenName.pattern.test(trimmed)) {
        this.addError('name', 'Token name contains invalid characters', 'INVALID_FORMAT');
      }
    }

    return this;
  }

  // Token symbol validation
  validateTokenSymbol(symbol: string, required: boolean = true): this {
    if (!symbol && required) {
      this.addError('symbol', 'Token symbol is required', 'REQUIRED');
      return this;
    }

    if (symbol) {
      const trimmed = symbol.trim().toUpperCase();
      if (trimmed.length < VALIDATION_RULES.tokenSymbol.minLength) {
        this.addError('symbol', `Token symbol must be at least ${VALIDATION_RULES.tokenSymbol.minLength} character`, 'MIN_LENGTH');
      }
      if (trimmed.length > VALIDATION_RULES.tokenSymbol.maxLength) {
        this.addError('symbol', `Token symbol must not exceed ${VALIDATION_RULES.tokenSymbol.maxLength} characters`, 'MAX_LENGTH');
      }
      if (!VALIDATION_RULES.tokenSymbol.pattern.test(trimmed)) {
        this.addError('symbol', 'Token symbol must contain only uppercase letters and numbers', 'INVALID_FORMAT');
      }
    }

    return this;
  }

  // Decimals validation
  validateDecimals(decimals: number, required: boolean = true): this {
    if (decimals === undefined || decimals === null) {
      if (required) {
        this.addError('decimals', 'Token decimals is required', 'REQUIRED');
      }
      return this;
    }

    if (!Number.isInteger(decimals)) {
      this.addError('decimals', 'Decimals must be an integer', 'INVALID_TYPE');
    } else if (decimals < 0 || decimals > 9) {
      this.addError('decimals', 'Decimals must be between 0 and 9', 'OUT_OF_RANGE');
    }

    return this;
  }

  // Supply validation
  validateSupply(supply: string, required: boolean = true): this {
    if (!supply && required) {
      this.addError('supply', 'Supply is required', 'REQUIRED');
      return this;
    }

    if (supply) {
      const trimmed = supply.trim();
      const numericValue = parseFloat(trimmed);
      
      if (isNaN(numericValue)) {
        this.addError('supply', 'Supply must be a valid number', 'INVALID_FORMAT');
      } else if (numericValue < 0) {
        this.addError('supply', 'Supply cannot be negative', 'NEGATIVE_VALUE');
      } else if (numericValue === 0) {
        this.addError('supply', 'Supply must be greater than zero', 'ZERO_VALUE');
      } else if (!Number.isFinite(numericValue)) {
        this.addError('supply', 'Supply must be a finite number', 'INFINITE_VALUE');
      }
    }

    return this;
  }

  // Wallet address validation
  validateWalletAddress(address: string, required: boolean = true): this {
    if (!address && required) {
      this.addError('walletAddress', 'Wallet address is required', 'REQUIRED');
      return this;
    }

    if (address) {
      const trimmed = address.trim();
      
      if (trimmed.length < VALIDATION_RULES.walletAddress.length[0] || 
          trimmed.length > VALIDATION_RULES.walletAddress.length[1]) {
        this.addError('walletAddress', 'Invalid wallet address length', 'INVALID_LENGTH');
      }
      
      if (!VALIDATION_RULES.walletAddress.pattern.test(trimmed)) {
        this.addError('walletAddress', 'Invalid wallet address format', 'INVALID_FORMAT');
      }
    }

    return this;
  }

  // Transaction signature validation
  validateTransactionSignature(signature: string, required: boolean = true): this {
    if (!signature && required) {
      this.addError('transactionSignature', 'Transaction signature is required', 'REQUIRED');
      return this;
    }

    if (signature) {
      const trimmed = signature.trim();
      
      if (trimmed.length < VALIDATION_RULES.transactionSignature.minLength || 
          trimmed.length > VALIDATION_RULES.transactionSignature.maxLength) {
        this.addError('transactionSignature', 'Invalid transaction signature length', 'INVALID_LENGTH');
      }
      
      if (!VALIDATION_RULES.transactionSignature.pattern.test(trimmed)) {
        this.addError('transactionSignature', 'Invalid transaction signature format', 'INVALID_FORMAT');
      }
    }

    return this;
  }

  // Amount validation (for SOL/token amounts)
  validateAmount(amount: string, field: string = 'amount', min?: number, max?: number, required: boolean = true): this {
    if (!amount && required) {
      this.addError(field, `${field} is required`, 'REQUIRED');
      return this;
    }

    if (amount) {
      const trimmed = amount.trim();
      const numericValue = parseFloat(trimmed);
      
      if (isNaN(numericValue)) {
        this.addError(field, `${field} must be a valid number`, 'INVALID_FORMAT');
      } else if (numericValue < 0) {
        this.addError(field, `${field} cannot be negative`, 'NEGATIVE_VALUE');
      } else if (min !== undefined && numericValue < min) {
        this.addError(field, `${field} must be at least ${min}`, 'BELOW_MINIMUM');
      } else if (max !== undefined && numericValue > max) {
        this.addError(field, `${field} must not exceed ${max}`, 'ABOVE_MAXIMUM');
      }
    }

    return this;
  }

  // URL validation
  validateUrl(url: string, field: string = 'url', required: boolean = false): this {
    if (!url && required) {
      this.addError(field, `${field} is required`, 'REQUIRED');
      return this;
    }

    if (url) {
      const trimmed = url.trim();
      try {
        new URL(trimmed);
      } catch {
        this.addError(field, `${field} must be a valid URL`, 'INVALID_FORMAT');
      }
    }

    return this;
  }

  // String length validation
  validateStringLength(value: string, field: string, minLength?: number, maxLength?: number, required: boolean = false): this {
    if (!value && required) {
      this.addError(field, `${field} is required`, 'REQUIRED');
      return this;
    }

    if (value) {
      const trimmed = value.trim();
      
      if (minLength !== undefined && trimmed.length < minLength) {
        this.addError(field, `${field} must be at least ${minLength} characters`, 'MIN_LENGTH');
      }
      
      if (maxLength !== undefined && trimmed.length > maxLength) {
        this.addError(field, `${field} must not exceed ${maxLength} characters`, 'MAX_LENGTH');
      }
    }

    return this;
  }

  // Email validation
  validateEmail(email: string, required: boolean = false): this {
    if (!email && required) {
      this.addError('email', 'Email is required', 'REQUIRED');
      return this;
    }

    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        this.addError('email', 'Invalid email format', 'INVALID_FORMAT');
      }
    }

    return this;
  }

  // Custom validation
  validateCustom(condition: boolean, field: string, message: string, code: string = 'CUSTOM_ERROR'): this {
    if (!condition) {
      this.addError(field, message, code);
    }
    return this;
  }

  private addError(field: string, message: string, code: string): void {
    this.errors.push(new ValidationError(field, message, code));
  }

  // Get validation result
  getResult(): ValidationResult {
    return {
      isValid: this.errors.length === 0,
      errors: this.errors.map(error => `${error.field}: ${error.message}`),
    };
  }

  // Throw API error if validation fails
  throwIfInvalid(): void {
    if (this.errors.length > 0) {
      const firstError = this.errors[0];
      throw APIError.invalidArgument(firstError.message, {
        field: firstError.field,
        code: firstError.code,
        allErrors: this.errors.map(e => ({
          field: e.field,
          message: e.message,
          code: e.code,
        })),
      });
    }
  }

  // Get all errors
  getErrors(): ValidationError[] {
    return [...this.errors];
  }

  // Check if specific field has errors
  hasErrors(field?: string): boolean {
    if (field) {
      return this.errors.some(error => error.field === field);
    }
    return this.errors.length > 0;
  }

  // Clear all errors
  clear(): this {
    this.errors = [];
    return this;
  }
}

// Utility functions
export const validateInput = (): InputValidator => new InputValidator();

// Quick validation functions
export const isValidWalletAddress = (address: string): boolean => {
  return validateInput().validateWalletAddress(address).getResult().isValid;
};

export const isValidTransactionSignature = (signature: string): boolean => {
  return validateInput().validateTransactionSignature(signature).getResult().isValid;
};

export const isValidTokenSymbol = (symbol: string): boolean => {
  return validateInput().validateTokenSymbol(symbol).getResult().isValid;
};

export const isValidAmount = (amount: string, min?: number, max?: number): boolean => {
  return validateInput().validateAmount(amount, 'amount', min, max).getResult().isValid;
};
