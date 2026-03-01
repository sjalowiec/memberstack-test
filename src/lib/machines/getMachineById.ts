import machinesData from '../../data/machines/machines.json';

export interface Machine {
  id: string;
  model: string;
  brand: string;
  productType: 'machine' | 'ribber' | 'bundle';
  status: 'active' | 'inactive' | 'discontinued';
  gauge: string;
  gaugeLabel: string;
  gaugeMm: number;
  needlePitch: string;
  bedWidthNeedles: number;
  bedWidthCm: string;
  yarnYppMin: number;
  yarnYppMax: number;
  cycaMin: number;
  cycaMax: number;
  operationType: string;
  softwareRequired: boolean;
  patternInputMethod: string;
  learningCurve: 'low' | 'medium' | 'high';
  beginnerFriendly: boolean;
  idealFirstMachine: boolean;
  compatibleRibbers: boolean;
  machineWeightLbs: number;
  shortDescription: string;
  keyBenefits: string[];
  includedItems: string[];
  warrantyNotes: string;
  priceUSD: number;
  availability: string;
  leadTimeNotes: string;
  isBundle: boolean;
  bundleIncludes: string[];
  primaryImage: string;
  galleryImages: string[];
  agentVisible: boolean;
  shopifyProductId: string;
  buyButtonDivId: string;
  lastUpdated: string;
}

export function getAllMachines(): Machine[] {
  return machinesData as Machine[];
}

export function getVisibleMachines(): Machine[] {
  const machines = getAllMachines();
  return machines.filter(m => m.agentVisible && m.status === 'active');
}

export function getMachineById(id: string): Machine | undefined {
  const machines = getAllMachines();
  return machines.find(m => m.id === id);
}

export function getMachinesByGauge(gauge: string): Machine[] {
  const machines = getVisibleMachines();
  return machines.filter(m => m.gauge === gauge);
}

export function getMachinesByType(productType: string): Machine[] {
  const machines = getVisibleMachines();
  return machines.filter(m => m.productType === productType);
}

export function getUniqueGauges(): string[] {
  const machines = getVisibleMachines();
  const gauges = new Set(machines.map(m => m.gauge));
  return Array.from(gauges);
}

export function getUniqueProductTypes(): string[] {
  const machines = getVisibleMachines();
  const types = new Set(machines.map(m => m.productType));
  return Array.from(types);
}

export function getUniqueAvailabilityStatuses(): string[] {
  const machines = getVisibleMachines();
  const statuses = new Set(machines.map(m => m.availability));
  return Array.from(statuses);
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(price);
}
