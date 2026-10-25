import { TnReport, MoReport } from './Reports';

export const revenueSources = [
  { id: 'tnservice', label: 'TN Service', Report: TnReport },
  { id: 'mohomestay', label: 'MoHomestay', Report: MoReport },
] as const;

export const getRevenueSource = (id: string | null) => revenueSources.find(source => source.id === id) || revenueSources[0];
