/**
 * Barcode configuration API (US-BC-008/009/010) — College System
 * Administrator settings for card format, content, and layout.
 *
 * INTEGRATION CONTRACT:
 *   GET    /api/barcode/config           → BarcodeConfig
 *   PUT    /api/barcode/config           → BarcodeConfig (full replace)
 */

import { simulateLatency } from '@/shared/lib/mock-helpers';
import { DEFAULT_BARCODE_CONFIG, type BarcodeConfig } from '../lib/barcodeConfig';

/** In-memory singleton config (one per cycle on the real backend). */
let CONFIG_STATE: BarcodeConfig = {
  ...DEFAULT_BARCODE_CONFIG,
  content: DEFAULT_BARCODE_CONFIG.content.map((f) => ({ ...f })),
};

export const barcodeConfigService = {
  async getConfig(): Promise<BarcodeConfig> {
    await simulateLatency();
    return {
      ...CONFIG_STATE,
      content: CONFIG_STATE.content.map((f) => ({ ...f })),
    };
  },

  async updateConfig(next: BarcodeConfig): Promise<BarcodeConfig> {
    await simulateLatency();
    CONFIG_STATE = {
      format: { ...next.format },
      content: next.content.map((f) => ({ ...f })),
      layout: { ...next.layout },
    };
    return this.getConfig();
  },
};
