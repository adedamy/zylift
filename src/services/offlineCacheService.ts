import { INITIAL_OFFLINE_REGIONS } from '../data/mockData';
import { OfflineCityRegion } from '../types';

const STORAGE_KEY_REGIONS = 'zylift_cached_regions';
const STORAGE_KEY_LITE_MODE = 'zylift_lite_mode';
const STORAGE_KEY_DATA_SAVED = 'zylift_data_saved_mb';

class OfflineCacheService {
  private regions: OfflineCityRegion[];
  private isLowBandwidth: boolean;
  private dataSavedMb: number;

  constructor() {
    const savedRegions = localStorage.getItem(STORAGE_KEY_REGIONS);
    if (savedRegions) {
      try {
        this.regions = JSON.parse(savedRegions);
      } catch {
        this.regions = INITIAL_OFFLINE_REGIONS;
      }
    } else {
      this.regions = INITIAL_OFFLINE_REGIONS;
      localStorage.setItem(STORAGE_KEY_REGIONS, JSON.stringify(this.regions));
    }

    this.isLowBandwidth = localStorage.getItem(STORAGE_KEY_LITE_MODE) === 'true';
    this.dataSavedMb = parseFloat(localStorage.getItem(STORAGE_KEY_DATA_SAVED) || '38.4');
  }

  getRegions(): OfflineCityRegion[] {
    return [...this.regions];
  }

  isLiteMode(): boolean {
    return this.isLowBandwidth;
  }

  setLiteMode(enabled: boolean): void {
    this.isLowBandwidth = enabled;
    localStorage.setItem(STORAGE_KEY_LITE_MODE, String(enabled));
  }

  getDataSavedMb(): number {
    return Math.round(this.dataSavedMb * 10) / 10;
  }

  recordDataSaved(mb: number): void {
    this.dataSavedMb += mb;
    localStorage.setItem(STORAGE_KEY_DATA_SAVED, String(this.dataSavedMb));
  }

  async downloadRegion(regionId: string, onProgress?: (pct: number) => void): Promise<void> {
    // Simulate streaming tile batch cache into CacheStorage / IndexedDB
    for (let i = 1; i <= 10; i++) {
      await new Promise((resolve) => setTimeout(resolve, 150));
      if (onProgress) {
        onProgress(i * 10);
      }
    }

    this.regions = this.regions.map((reg) => {
      if (reg.id === regionId) {
        return {
          ...reg,
          isDownloaded: true,
          lastUpdated: 'Just now',
        };
      }
      return reg;
    });

    localStorage.setItem(STORAGE_KEY_REGIONS, JSON.stringify(this.regions));
  }

  removeRegion(regionId: string): void {
    this.regions = this.regions.map((reg) => {
      if (reg.id === regionId) {
        return {
          ...reg,
          isDownloaded: false,
          lastUpdated: 'Not cached',
        };
      }
      return reg;
    });

    localStorage.setItem(STORAGE_KEY_REGIONS, JSON.stringify(this.regions));
  }

  /**
   * Generate an offline Nigerian USSD ride booking fallback string
   * Works on MTN, Airtel, Glo, 9mobile when 4G/3G data is down
   */
  generateUssdBookingCode(pickupName: string, destName: string, category: string): string {
    const catCode = category === 'okada' ? '1' : category === 'keke' ? '2' : '3';
    return `*384*400*${catCode}#`;
  }
}

export const offlineCacheService = new OfflineCacheService();
