import { getSupabaseServerClient } from '../supabase/server';

const BCV_SOURCES = [
  {
    name: 've.dolarapi.com',
    url: 'https://ve.dolarapi.com/v1/dolares/oficial',
    rateKeys: ['promedio'],
  },
  {
    name: 'pydolarve.org',
    url: 'https://pydolarve.org/api/v1/dollar?page=bcv',
    rateKeys: ['promedio', 'bcv', 'price', 'valor', 'value', 'rate', 'venta', 'tasa'],
  },
] as const;
const BCV_RATE_SOURCE = 'bcv_official_ves';
const SOURCE_TIMEOUT_MS = 6000;
const STEAM_VARIANT_ID = 'v-s10-glo';

type PricingRow = {
  variant_id: string;
  final_price_usd: number | string | null;
};

type StoredRate = {
  rate: number;
  updatedAt: string | null;
  source: string;
};

type PersistResult = {
  productPricingUpdated: number;
  exchangeRateUpdated: boolean;
  warnings: string[];
};

export async function refreshBcvRate() {
  const sourceErrors: string[] = [];

  for (const source of BCV_SOURCES) {
    try {
      const rate = await fetchRate(source.url, source.rateKeys);
      const persisted = await persistBcvRate(rate);
      return {
        success: true as const,
        rate,
        bcv_rate: rate,
        source: source.name,
        updatedAt: new Date().toISOString(),
        stale: false,
        persisted: persisted.productPricingUpdated > 0,
        ...((persisted.warnings.length > 0 || !persisted.productPricingUpdated)
          ? {
              warning: persisted.warnings.length > 0
                ? persisted.warnings.join(' ')
                : 'No se encontró configuración de producto para actualizar product_pricing.bcv_rate.',
            }
          : {}),
      };
    } catch (error) {
      const message = errorMessage(error);
      sourceErrors.push(`${source.name}: ${message}`);
      console.warn(`[bcv][source:${source.name}] No se pudo obtener una tasa válida: ${message}`);
    }
  }

  try {
    const storedRate = await getStoredBcvRate();
    if (storedRate) {
      const persisted = await persistBcvRate(storedRate.rate);
      console.warn(`[bcv][fallback:${storedRate.source}] Se usará la última tasa válida guardada.`);
      return {
        success: true as const,
        ...storedRate,
        bcv_rate: storedRate.rate,
        stale: true,
        persisted: persisted.productPricingUpdated > 0,
        warning: [
          'Las fuentes externas no respondieron; se devuelve la última tasa válida de Supabase.',
          ...sourceErrors,
          ...persisted.warnings,
        ].join(' '),
      };
    }
  } catch (error) {
    const message = errorMessage(error);
    console.error('[bcv][stored-rate] Falló la lectura de la tasa de respaldo en Supabase:', error);
    throw new Error(
      `Fallaron las fuentes BCV (${sourceErrors.join('; ')}) y la lectura de Supabase (${message}).`
    );
  }

  throw new Error(
    `Fallaron las fuentes BCV (${sourceErrors.join('; ')}) y no existe una tasa válida guardada en Supabase.`
  );
}

export async function getStoredBcvRate(): Promise<StoredRate | null> {
  const supabase = getSupabaseServerClient();
  let pricingReadError: string | null = null;
  try {
    const { data: steamPricing, error: steamPricingError } = await supabase
      .from('product_pricing')
      .select('bcv_rate, updated_at')
      .eq('variant_id', STEAM_VARIANT_ID)
      .maybeSingle();

    if (steamPricingError) throw steamPricingError;
    const steamRate = toValidRate(steamPricing?.bcv_rate);
    if (steamRate !== null) {
      return {
        rate: steamRate,
        updatedAt: steamPricing.updated_at,
        source: 'supabase:product_pricing:v-s10-glo',
      };
    }

    const { data: pricingRows, error: pricingError } = await supabase
      .from('product_pricing')
      .select('bcv_rate, updated_at')
      .not('bcv_rate', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(20);

    if (pricingError) throw pricingError;

    for (const row of pricingRows ?? []) {
      const rate = toValidRate(row.bcv_rate);
      if (rate !== null) {
        return {
          rate,
          updatedAt: row.updated_at,
          source: 'supabase:product_pricing',
        };
      }
    }
  } catch (error) {
    pricingReadError = errorMessage(error);
    console.warn(`[bcv][stored-rate:product_pricing] No se pudo leer el respaldo: ${pricingReadError}`);
  }

  let exchangeRate: { rate: number | string; updated_at: string } | null = null;
  let currencyLookupError: string | null = null;
  try {
    const { data, error } = await supabase
      .from('exchange_rates')
      .select('rate, updated_at')
      .eq('currency', 'USD')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    exchangeRate = data;
  } catch (error) {
    currencyLookupError = errorMessage(error);
    console.warn(
      `[bcv][stored-rate:exchange_rates.currency] No se pudo consultar currency='USD'; se probará el esquema source: ${currencyLookupError}`
    );
  }

  if (!exchangeRate) {
    try {
      const { data, error } = await supabase
        .from('exchange_rates')
        .select('rate, updated_at')
        .eq('source', BCV_RATE_SOURCE)
        .maybeSingle();

      if (error) throw error;
      exchangeRate = data;
    } catch (error) {
      const sourceLookupError = errorMessage(error);
      throw new Error(
        `No se pudo leer product_pricing (${pricingReadError ?? 'sin tasa válida'}), exchange_rates.currency (${currencyLookupError ?? 'sin tasa válida'}) ni exchange_rates.source (${sourceLookupError}).`
      );
    }
  }

  if (!exchangeRate) {
    if (currencyLookupError) {
      console.warn(`[bcv][stored-rate] No se encontró tasa BCV guardada: ${currencyLookupError}`);
    }
    return null;
  }

  const rate = toValidRate(exchangeRate.rate);
  if (rate === null) {
    throw new Error('La tasa BCV guardada en Supabase no es válida.');
  }
  return {
    rate,
    updatedAt: exchangeRate.updated_at,
    source: 'supabase:exchange_rates',
  };
}

async function fetchRate(url: string, rateKeys: readonly string[]) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SOURCE_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload: unknown = await response.json();
    const rate = extractRate(payload, rateKeys);
    if (rate === null) {
      throw new Error('La respuesta JSON no contiene una tasa numérica válida.');
    }
    return rate;
  } finally {
    clearTimeout(timeout);
  }
}

function extractRate(value: unknown, rateKeys: readonly string[]): number | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const rate = extractRate(item, rateKeys);
      if (rate !== null) return rate;
    }
    return null;
  }

  if (typeof value !== 'object' || value === null) return null;
  const record = value as Record<string, unknown>;

  for (const key of rateKeys) {
    if (key in record) {
      const rate = toValidRate(record[key]);
      if (rate !== null) return rate;
    }
  }
  for (const nestedValue of Object.values(record)) {
    const rate = extractRate(nestedValue, rateKeys);
    if (rate !== null) return rate;
  }
  return null;
}

function toValidRate(value: unknown) {
  const rate = typeof value === 'number'
    ? value
    : typeof value === 'string'
      ? Number(value.replace(',', '.'))
      : NaN;
  return Number.isFinite(rate) && rate > 0 ? rate : null;
}

async function persistBcvRate(rate: number): Promise<PersistResult> {
  const warnings: string[] = [];
  let productPricingUpdated = 0;
  let exchangeRateUpdated = false;
  const updatedAt = new Date().toISOString();

  let supabase: ReturnType<typeof getSupabaseServerClient>;
  try {
    supabase = getSupabaseServerClient();
  } catch (error) {
    const message = `No se pudo inicializar Supabase: ${errorMessage(error)}`;
    console.error(`[bcv][persist] ${message}`);
    return {
      productPricingUpdated,
      exchangeRateUpdated,
      warnings: [message],
    };
  }

  try {
    const { data: pricingRows, error: pricingError } = await supabase
      .from('product_pricing')
      .select('variant_id, final_price_usd');
    if (pricingError) throw pricingError;

    for (const row of (pricingRows ?? []) as PricingRow[]) {
      const finalPriceUsd = row.final_price_usd === null ? null : toValidRate(row.final_price_usd);
      const updates: { bcv_rate: number; final_price_bs?: number; updated_at: string } = {
        bcv_rate: rate,
        updated_at: updatedAt,
      };
      if (finalPriceUsd !== null) {
        updates.final_price_bs = Math.ceil(finalPriceUsd * rate);
      }

      const { error: updateError } = await supabase
        .from('product_pricing')
        .update(updates)
        .eq('variant_id', row.variant_id);
      if (updateError) {
        throw new Error(`${row.variant_id}: ${errorMessage(updateError)}`);
      }
      productPricingUpdated += 1;
    }
  } catch (error) {
    const message = `No se pudo actualizar product_pricing.bcv_rate/precio en Bs.: ${errorMessage(error)}`;
    warnings.push(message);
    console.error(`[bcv][persist:product_pricing] ${message}`);
  }

  try {
    const { error } = await supabase
      .from('exchange_rates')
      .upsert(
        { source: BCV_RATE_SOURCE, rate, updated_at: updatedAt },
        { onConflict: 'source' }
      );
    if (error) throw error;
    exchangeRateUpdated = true;
  } catch (error) {
    const message = `No se pudo actualizar exchange_rates: ${errorMessage(error)}`;
    warnings.push(message);
    console.error(`[bcv][persist:exchange_rates] ${message}`);
  }

  return { productPricingUpdated, exchangeRateUpdated, warnings };
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'error desconocido';
}
