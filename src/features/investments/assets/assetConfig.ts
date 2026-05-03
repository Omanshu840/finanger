import {
  TrendingUp,
  PieChart,
  Building2,
  Lock,
  Briefcase,
  Banknote,
  type LucideIcon,
} from 'lucide-react'
import type { AssetType } from '@/features/investments/types/asset.types'

export interface AssetTypeConfig {
  label: string
  icon: LucideIcon
  color: string           // Tailwind bg class for icon container
  textColor: string       // Tailwind text class for icon
  quantityLabel: string   // "Shares" | "Units" | "" 
}

export const ASSET_TYPE_CONFIG: Record<AssetType, AssetTypeConfig> = {
  stock: {
    label: 'Stocks',
    icon: TrendingUp,
    color: 'bg-blue-500/10',
    textColor: 'text-blue-500',
    quantityLabel: 'shares',
  },
  mf: {
    label: 'Mutual Funds',
    icon: PieChart,
    color: 'bg-violet-500/10',
    textColor: 'text-violet-500',
    quantityLabel: 'units',
  },
  bank: {
    label: 'Bank Accounts',
    icon: Building2,
    color: 'bg-emerald-500/10',
    textColor: 'text-emerald-500',
    quantityLabel: '',
  },
  fd: {
    label: 'Fixed Deposits',
    icon: Lock,
    color: 'bg-amber-500/10',
    textColor: 'text-amber-500',
    quantityLabel: '',
  },
  esop: {
    label: 'ESOPs',
    icon: Briefcase,
    color: 'bg-rose-500/10',
    textColor: 'text-rose-500',
    quantityLabel: 'options',
  },
  cash: {
    label: 'Cash',
    icon: Banknote,
    color: 'bg-teal-500/10',
    textColor: 'text-teal-500',
    quantityLabel: '',
  },
}

// Display order on screen
export const ASSET_TYPE_ORDER: AssetType[] = [
  'stock', 'mf', 'bank', 'fd', 'esop', 'cash',
]