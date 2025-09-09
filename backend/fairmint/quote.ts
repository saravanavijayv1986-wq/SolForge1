import { api, APIError } from "encore.dev/api";
import { fairMintDB } from "./db";
import { price } from "~encore/clients";

export interface GetQuoteRequest {
  tokenMintAddress: string;
  tokenAmount: string;
  userWallet: string;
}

export interface GetQuoteResponse {
  quoteId: string;
  tokenAmount: string;
  usdValue: string;
  estimatedSolf: string;
  priceSource: string;
  priceAtQuote: string;
  expiresAt: Date;
  remainingCapUsd: string;
  userBurnedTodayUsd: string;
  maxAllowedUsd: string;
}

export interface ValidateQuoteRequest {
  quoteId: string;
  userWallet: string;
}

export interface ValidateQuoteResponse {
  isValid: boolean;
  quote?: GetQuoteResponse;
  error?: string;
}

// Gets a price quote for burning tokens
export const getQuote = api<GetQuoteRequest, GetQuoteResponse>(
  { expose: true, method: "POST", path: "/fair-mint/quote" },
  async (req) => {
    // Get active event
    const event = await fairMintDB.queryRow<{
      id: number;
      isActive: boolean;
      isFinalized: boolean;
      startTime: Date;
      endTime: Date;
      maxPerWalletUsd: string;
      maxPerTxUsd: string;
      quoteTtlSeconds: number;
      minTxUsd: string;
    }>`
      SELECT id, is_active as "isActive", is_finalized as "isFinalized",
             start_time as "startTime", end_time as "endTime",
             max_per_wallet_usd as "maxPerWalletUsd", max_per_tx_usd as "maxPerTxUsd",
             quote_ttl_seconds as "quoteTtlSeconds", min_tx_usd as "minTxUsd"
      FROM fair_mint_events 
      WHERE is_active = true 
      LIMIT 1
    `;

    if (!event) {
      throw APIError.notFound("No active fair mint event");
    }

    if (!event.isActive || event.isFinalized) {
      throw APIError.failedPrecondition("Fair mint event is not currently active");
    }

    const now = new Date();
    if (now < event.startTime || now > event.endTime) {
      throw APIError.failedPrecondition("Fair mint event is not currently live");
    }

    // Validate token is accepted
    const acceptedToken = await fairMintDB.queryRow<{
      tokenName: string;
      tokenSymbol: string;
      isActive: boolean;
      dailyCapUsd: string;
      currentDailyBurnedUsd: string;
    }>`
      SELECT token_name as "tokenName", token_symbol as "tokenSymbol",
             is_active as "isActive", daily_cap_usd as "dailyCapUsd",
             current_daily_burned_usd as "currentDailyBurnedUsd"
      FROM fair_mint_accepted_tokens 
      WHERE event_id = ${event.id} AND mint_address = ${req.tokenMintAddress} AND is_active = true
    `;

    if (!acceptedToken) {
      throw APIError.invalidArgument("Token is not accepted for this fair mint event");
    }

    // Validate token amount
    const tokenAmount = parseFloat(req.tokenAmount);
    if (isNaN(tokenAmount) || tokenAmount <= 0) {
      throw APIError.invalidArgument("Token amount must be a positive number");
    }

    // Get token price from the price service
    const priceResponse = await price.getPrice({ mint: req.tokenMintAddress });
    if (priceResponse.route === 'not_found' || priceResponse.usd <= 0) {
      throw APIError.notFound(`Could not find a valid price for token ${acceptedToken.tokenSymbol}`);
    }
    const tokenPrice = priceResponse.usd;
    const usdValue = tokenAmount * tokenPrice;

    // Validate minimum transaction
    const minTxUsd = parseFloat(event.minTxUsd);
    if (usdValue < minTxUsd) {
      throw APIError.invalidArgument(`Minimum transaction is $${minTxUsd}`);
    }

    // Validate maximum per transaction
    const maxPerTxUsd = parseFloat(event.maxPerTxUsd);
    if (usdValue > maxPerTxUsd) {
      throw APIError.invalidArgument(`Maximum per transaction is $${maxPerTxUsd}`);
    }

    // Check user's total burned today
    const userBurnedToday = await fairMintDB.queryRow<{ totalBurned: string }>`
      SELECT COALESCE(SUM(usd_value_at_burn), 0)::TEXT as "totalBurned"
      FROM fair_mint_burns 
      WHERE event_id = ${event.id} AND user_wallet = ${req.userWallet}
        AND burn_timestamp >= CURRENT_DATE
    `;

    const userBurnedTodayUsd = parseFloat(userBurnedToday?.totalBurned || '0');
    const maxPerWalletUsd = parseFloat(event.maxPerWalletUsd);
    
    if (userBurnedTodayUsd + usdValue > maxPerWalletUsd) {
      throw APIError.invalidArgument(`Would exceed maximum of $${maxPerWalletUsd} per wallet`);
    }

    // Check daily cap for token
    const dailyCapUsd = parseFloat(acceptedToken.dailyCapUsd);
    const currentDailyBurnedUsd = parseFloat(acceptedToken.currentDailyBurnedUsd);
    const remainingCapUsd = dailyCapUsd - currentDailyBurnedUsd;

    if (usdValue > remainingCapUsd) {
      throw APIError.invalidArgument(`Would exceed daily cap for ${acceptedToken.tokenSymbol}. Remaining: $${remainingCapUsd.toFixed(2)}`);
    }

    // Estimate SOLF allocation (simplified calculation)
    const estimatedSolf = usdValue * 1000; // Mock: 1000 SOLF per USD

    // Generate quote ID
    const quoteId = `quote_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const expiresAt = new Date(Date.now() + event.quoteTtlSeconds * 1000);

    // Store quote
    await fairMintDB.exec`
      INSERT INTO fair_mint_quotes (
        quote_id, event_id, user_wallet, token_mint_address, token_amount,
        usd_value, estimated_solf, price_source, price_at_quote, expires_at
      )
      VALUES (
        ${quoteId}, ${event.id}, ${req.userWallet}, ${req.tokenMintAddress}, ${String(tokenAmount)}::numeric,
        ${String(usdValue)}::numeric, ${String(estimatedSolf)}::numeric, ${priceResponse.route}, ${String(tokenPrice)}::numeric, ${expiresAt}
      )
    `;

    return {
      quoteId,
      tokenAmount: tokenAmount.toString(),
      usdValue: usdValue.toString(),
      estimatedSolf: estimatedSolf.toString(),
      priceSource: priceResponse.route,
      priceAtQuote: tokenPrice.toString(),
      expiresAt,
      remainingCapUsd: remainingCapUsd.toString(),
      userBurnedTodayUsd: userBurnedTodayUsd.toString(),
      maxAllowedUsd: (maxPerWalletUsd - userBurnedTodayUsd).toString()
    };
  }
);

// Validates a quote before burning
export const validateQuote = api<ValidateQuoteRequest, ValidateQuoteResponse>(
  { expose: true, method: "POST", path: "/fair-mint/quote/validate" },
  async (req) => {
    const quote = await fairMintDB.queryRow<{
      quoteId: string;
      eventId: number;
      userWallet: string;
      tokenMintAddress: string;
      tokenAmount: string;
      usdValue: string;
      estimatedSolf: string;
      priceSource: string;
      priceAtQuote: string;
      expiresAt: Date;
      isUsed: boolean;
    }>`
      SELECT quote_id as "quoteId", event_id as "eventId", user_wallet as "userWallet",
             token_mint_address as "tokenMintAddress", token_amount as "tokenAmount",
             usd_value as "usdValue", estimated_solf as "estimatedSolf",
             price_source as "priceSource", price_at_quote as "priceAtQuote",
             expires_at as "expiresAt", is_used as "isUsed"
      FROM fair_mint_quotes 
      WHERE quote_id = ${req.quoteId}
    `;

    if (!quote) {
      return {
        isValid: false,
        error: "Quote not found"
      };
    }

    if (quote.userWallet !== req.userWallet) {
      return {
        isValid: false,
        error: "Quote belongs to different wallet"
      };
    }

    if (quote.isUsed) {
      return {
        isValid: false,
        error: "Quote has already been used"
      };
    }

    if (new Date() > quote.expiresAt) {
      return {
        isValid: false,
        error: "Quote has expired"
      };
    }

    // Get event and token info for cap validation
    const event = await fairMintDB.queryRow<{ maxPerWalletUsd: string }>`
      SELECT max_per_wallet_usd as "maxPerWalletUsd"
      FROM fair_mint_events 
      WHERE id = ${quote.eventId}
    `;

    const acceptedToken = await fairMintDB.queryRow<{
      dailyCapUsd: string;
      currentDailyBurnedUsd: string;
    }>`
      SELECT daily_cap_usd as "dailyCapUsd", current_daily_burned_usd as "currentDailyBurnedUsd"
      FROM fair_mint_accepted_tokens 
      WHERE event_id = ${quote.eventId} AND mint_address = ${quote.tokenMintAddress}
    `;

    if (!acceptedToken || !event) {
      return {
        isValid: false,
        error: "Token or event no longer valid"
      };
    }

    const dailyCapUsd = parseFloat(acceptedToken.dailyCapUsd);
    const currentDailyBurnedUsd = parseFloat(acceptedToken.currentDailyBurnedUsd);
    const remainingCapUsd = dailyCapUsd - currentDailyBurnedUsd;

    const userBurnedToday = await fairMintDB.queryRow<{ totalBurned: string }>`
      SELECT COALESCE(SUM(usd_value_at_burn), 0)::TEXT as "totalBurned"
      FROM fair_mint_burns 
      WHERE event_id = ${quote.eventId} AND user_wallet = ${req.userWallet}
        AND burn_timestamp >= CURRENT_DATE
    `;

    const userBurnedTodayUsd = parseFloat(userBurnedToday?.totalBurned || '0');
    const maxPerWalletUsd = parseFloat(event.maxPerWalletUsd);
    const maxAllowedUsd = maxPerWalletUsd - userBurnedTodayUsd;

    return {
      isValid: true,
      quote: {
        quoteId: quote.quoteId,
        tokenAmount: quote.tokenAmount,
        usdValue: quote.usdValue,
        estimatedSolf: quote.estimatedSolf,
        priceSource: quote.priceSource,
        priceAtQuote: quote.priceAtQuote,
        expiresAt: quote.expiresAt,
        remainingCapUsd: remainingCapUsd.toString(),
        userBurnedTodayUsd: userBurnedTodayUsd.toString(),
        maxAllowedUsd: maxAllowedUsd.toString()
      }
    };
  }
);
