/**
 * Shapes returned by the Solscan Pro API v2.0 (https://pro-api.solscan.io/v2.0).
 * Field names verified against the `solscan-js` community client's type
 * definitions (which mirror the official docs) - if Solscan changes its
 * response shape, the fix is isolated to `parseActivity` in client.ts.
 */

export interface ApiV2Response<T> {
  success: boolean;
  data: T;
  errors?: { code: number; message: string };
}

export interface SolscanRouters {
  token1: string;
  token1_decimals: number;
  amount1: number;
  token2: string;
  token2_decimals: number;
  amount2: number;
  child_routers?: Array<{
    token1: string;
    token1_decimals: number;
    amount1: string;
    token2: string;
    token2_decimals: number;
    amount2: string;
  }>;
}

export interface SolscanTokenDefiActivity {
  block_id: number;
  trans_id: string;
  block_time: number;
  activity_type: string;
  from_address: string;
  to_address: string;
  platform: string[];
  sources: string[];
  routers: SolscanRouters;
}

export interface SolscanTokenMeta {
  address: string;
  symbol: string;
  decimals: number;
  price: number;
}
