export type AvailabilityStatus = 
  | 'in-stock' 
  | 'pre-order' 
  | 'on-order' 
  | 'limited' 
  | 'backorder' 
  | 'discontinued';

export interface AvailabilityInfo {
  label: string;
  message: string;
  colorClass: string;
  inlineStyle: string;
}

export function getAvailabilityInfo(
  status: string,
  leadTimeNotes?: string | null
): AvailabilityInfo {
  const statusMap: Record<string, AvailabilityInfo> = {
    'in-stock': {
      label: 'In Stock',
      message: 'Available and ready to ship.',
      colorClass: 'availability-in-stock',
      inlineStyle: 'background: #dcfce7; color: #166534; border-color: #bbf7d0;'
    },
    'pre-order': {
      label: 'Pre-Order',
      message: leadTimeNotes 
        ? `Available for pre-order. Expected lead time: ${leadTimeNotes}.` 
        : 'Available for pre-order.',
      colorClass: 'availability-pre-order',
      inlineStyle: 'background: #dbeafe; color: #1e40af; border-color: #bfdbfe;'
    },
    'on-order': {
      label: 'On Order',
      message: leadTimeNotes 
        ? `Currently on order. Expected: ${leadTimeNotes}.` 
        : 'Currently on order from the manufacturer.',
      colorClass: 'availability-on-order',
      inlineStyle: 'background: #fef3c7; color: #92400e; border-color: #fde68a;'
    },
    'limited': {
      label: 'Limited',
      message: 'Limited quantities available.',
      colorClass: 'availability-limited',
      inlineStyle: 'background: #ffedd5; color: #9a3412; border-color: #fed7aa;'
    },
    'backorder': {
      label: 'Backorder',
      message: leadTimeNotes 
        ? `Currently backordered. ${leadTimeNotes}.` 
        : 'Currently backordered.',
      colorClass: 'availability-backorder',
      inlineStyle: 'background: #fef9c3; color: #854d0e; border-color: #fef08a;'
    },
    'discontinued': {
      label: 'Discontinued',
      message: 'This model has been discontinued.',
      colorClass: 'availability-discontinued',
      inlineStyle: 'background: #f3f4f6; color: #4b5563; border-color: #e5e7eb;'
    }
  };

  return statusMap[status] || statusMap['pre-order'];
}
