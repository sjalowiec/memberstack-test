import softwareData from '../../data/software/software.json';

export interface Software {
  id: string;
  slug: string;
  name: string;
  type: string;
  versionKey: string;
  purchaseUrl: string;
  outcomes: string[];
  tagline: string;
  included: string[];
  comparePopupId: string;
  upgradeInfoUrl: string;
  icon: string;
}

export function getAllSoftware(): Software[] {
  return softwareData as Software[];
}

export function getSoftwareById(id: string): Software | undefined {
  const software = getAllSoftware();
  return software.find(s => s.id === id);
}

export function getSoftwareBySlug(slug: string): Software | undefined {
  const software = getAllSoftware();
  return software.find(s => s.slug === slug);
}

export function getSoftwareByVersionKey(versionKey: string): Software | undefined {
  const software = getAllSoftware();
  return software.find(s => s.versionKey === versionKey);
}
