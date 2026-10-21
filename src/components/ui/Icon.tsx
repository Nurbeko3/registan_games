'use client';

import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  GraduationCap,
  Layers,
  LogOut,
  Menu,
  Monitor,
  Moon,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Send,
  Settings,
  Shield,
  Sun,
  Trash2,
  Upload,
  Users,
  Volume2,
  Info,
  CircleHelp,
  CircleCheck,
  Timer,
  Target,
  Maximize2,
  Minimize2,
  Binary,
  Bot,
  Brain,
  Bug,
  Building2,
  Calculator,
  Check,
  Clock,
  Cloud,
  Coins,
  Compass,
  Copy,
  Crown,
  Eye,
  FileText,
  Mail,
  MessageCircle,
  Search,
  Ticket,
  Flame,
  Gem,
  Gift,
  Globe,
  Heart,
  Home,
  LayoutGrid,
  Lock,
  LockOpen,
  Map as MapIcon,
  Medal,
  Mountain,
  PartyPopper,
  Puzzle,
  Repeat,
  Rocket,
  ShoppingBag,
  Sparkles,
  Star,
  Sword,
  Swords,
  Trees,
  Trophy,
  User,
  UserCircle,
  Wifi,
  Wrench,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react';

export type IconName =
  | 'arena'
  | 'bag'
  | 'binary'
  | 'bot'
  | 'brain'
  | 'bug'
  | 'calculator'
  | 'chat'
  | 'check'
  | 'city'
  | 'clock'
  | 'cloud'
  | 'coin'
  | 'compass'
  | 'copy'
  | 'crown'
  | 'eye'
  | 'file'
  | 'flame'
  | 'mail'
  | 'forest'
  | 'gem'
  | 'gift'
  | 'heart'
  | 'home'
  | 'lock'
  | 'loop'
  | 'map'
  | 'mountain'
  | 'party'
  | 'pattern'
  | 'planet'
  | 'profile'
  | 'puzzle'
  | 'rank'
  | 'rocket'
  | 'search'
  | 'signal'
  | 'ticket'
  | 'spark'
  | 'star'
  | 'sword'
  | 'trophy'
  | 'unlock'
  | 'user'
  | 'warning'
  | 'wrench'
  | 'x'
  | 'zap'
  | 'activity'
  | 'arrowLeft'
  | 'arrowRight'
  | 'barChart'
  | 'book'
  | 'chevronDown'
  | 'chevronLeft'
  | 'chevronRight'
  | 'download'
  | 'graduation'
  | 'layers'
  | 'logout'
  | 'menu'
  | 'monitor'
  | 'moon'
  | 'pencil'
  | 'play'
  | 'plus'
  | 'refresh'
  | 'send'
  | 'settings'
  | 'shield'
  | 'sunIcon'
  | 'trash'
  | 'upload'
  | 'users'
  | 'volume'
  | 'info'
  | 'help'
  | 'checkCircle'
  | 'timer'
  | 'target'
  | 'maximize'
  | 'minimize';

const gameIcons: Record<string, IconName> = {
  'robot-maze': 'bot',
  'memory-match': 'brain',
  'binary-challenge': 'binary',
  'algorithm-race': 'zap',
  'fix-the-bug': 'bug',
  'code-adventure': 'compass',
  'logic-puzzle': 'puzzle',
  'treasure-hunt': 'gem',
  'pattern-pop': 'pattern',
  'loop-output': 'loop',
  'quick-math': 'calculator',
  'variable-vault': 'ticket',
  'if-else-quest': 'compass',
  'list-lab': 'file',
};

const worldIcons: Record<string, IconName> = {
  'coding-forest': 'forest',
  'algorithm-mountain': 'mountain',
  'ai-city': 'city',
  'web-kingdom': 'crown',
  'python-planet': 'planet',
};

export function gameIcon(slug: string): IconName {
  return gameIcons[slug] ?? 'spark';
}

export function worldIcon(slug: string): IconName {
  return worldIcons[slug] ?? 'map';
}

export function Icon({ name, className = 'h-5 w-5' }: { name: IconName; className?: string }) {
  const LucideComponent = ICON_REGISTRY[name];
  return <LucideComponent className={className} strokeWidth={2} aria-hidden />;
}

export function IconTile({ name, className = '', iconClassName = 'h-7 w-7' }: { name: IconName; className?: string; iconClassName?: string }) {
  return (
    <span className={`grid place-items-center rounded-xl bg-brand-50 text-brand ring-1 ring-inset ring-brand-100 ${className}`}>
      <Icon name={name} className={iconClassName} />
    </span>
  );
}

/**
 * ICON_REGISTRY is the single migration seam: every IconName maps to a
 * matching Lucide component. TypeScript's Record<IconName, LucideIcon>
 * enforces compile-time completeness, so adding a new IconName without
 * registering it here is a typecheck error.
 */
const ICON_REGISTRY: Record<IconName, LucideIcon> = {
  arena: Swords,
  bag: ShoppingBag,
  binary: Binary,
  bot: Bot,
  brain: Brain,
  bug: Bug,
  calculator: Calculator,
  chat: MessageCircle,
  check: Check,
  city: Building2,
  clock: Clock,
  cloud: Cloud,
  coin: Coins,
  compass: Compass,
  copy: Copy,
  crown: Crown,
  eye: Eye,
  file: FileText,
  flame: Flame,
  mail: Mail,
  forest: Trees,
  gem: Gem,
  gift: Gift,
  heart: Heart,
  home: Home,
  lock: Lock,
  loop: Repeat,
  map: MapIcon,
  mountain: Mountain,
  party: PartyPopper,
  pattern: LayoutGrid,
  planet: Globe,
  profile: UserCircle,
  puzzle: Puzzle,
  rank: Medal,
  rocket: Rocket,
  search: Search,
  signal: Wifi,
  ticket: Ticket,
  spark: Sparkles,
  star: Star,
  sword: Sword,
  trophy: Trophy,
  unlock: LockOpen,
  user: User,
  warning: AlertTriangle,
  wrench: Wrench,
  x: X,
  zap: Zap,
  activity: Activity,
  arrowLeft: ArrowLeft,
  arrowRight: ArrowRight,
  barChart: BarChart3,
  book: BookOpen,
  chevronDown: ChevronDown,
  chevronLeft: ChevronLeft,
  chevronRight: ChevronRight,
  download: Download,
  graduation: GraduationCap,
  layers: Layers,
  logout: LogOut,
  menu: Menu,
  monitor: Monitor,
  moon: Moon,
  pencil: Pencil,
  play: Play,
  plus: Plus,
  refresh: RefreshCw,
  send: Send,
  settings: Settings,
  shield: Shield,
  sunIcon: Sun,
  trash: Trash2,
  upload: Upload,
  users: Users,
  volume: Volume2,
  info: Info,
  help: CircleHelp,
  checkCircle: CircleCheck,
  timer: Timer,
  target: Target,
  maximize: Maximize2,
  minimize: Minimize2,
};
