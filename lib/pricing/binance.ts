import { getSupabaseServerClient } from '../supabase/server';

const BINANCE_P2P_SEARCH_URL = 'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search';

type BinanceP2PResponse = {
  data?: Array<{
    adv?: {
      price?: string;
      asset?: string;
      fiatUnit?: string;
    };
  }>;
};

export async function refreshBinanceP2PRate() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(BINANCE_P2P_SEARCH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 LaCasitaGamer/1.0',
      },
      body: JSON.stringify({
        asset: 'USDT',
        fiat: 'VES',
        tradeType: 'SELL',
        page: 1,
        rows: 10,
        countries: [],
        proMerchantAds: false,
        shieldMerchantAds: false,
        filterType: 'all',
        periods: [],
        payTypes: [],
        additionalKycVerifyFilter: 0,
        publisherType: null,
        classifies: ['mass', 'profession'],
      }),
      cache: 'no-store',
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Binance P2P respondió con el estado ${response.status}.`);
    }

    const payload = await response.json() as BinanceP2PResponse;
    const prices = (payload.data ?? [])
      .map((offer) => {
        if (offer.adv?.asset !== 'USDT' || offer.adv?.fiatUnit !== 'VES') return NaN;
        return Number(offer.adv.price);
      })
      .filter((price) => Number.isFinite(price) && price > 0)
      .sort((left, right) => left - right);

    if (prices.length === 0) {
      throw new Error('Binance P2P no devolvió ofertas válidas USDT/VES.');
    }

    const middle = Math.floor(prices.length / 2);
    const rate = prices.length % 2 === 0
      ? (prices[middle - 1] + prices[middle]) / 2
      : prices[middle];
    const updatedAt = new Date().toISOString();
    const supabase = getSupabaseServerClient();
    const { error } = await supabase
      .from('exchange_rates')
      .upsert(
        { source: 'binance_p2p_usdt_ves', rate, updated_at: updatedAt },
        { onConflict: 'source' }
      );

    if (error) throw error;
    return { rate, updatedAt };
  } finally {
    clearTimeout(timeout);
  }
}
