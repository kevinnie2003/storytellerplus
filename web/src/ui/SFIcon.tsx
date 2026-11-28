import { useId } from 'react'
// iPad 版用 SF Symbols，网页不能用，这里换成样子最接近的 Lucide 图标。名字照写 SF Symbols 的名字
import {
  X, Plus, Minus, Settings, Download, Sparkles, CircleHelp, CirclePlus, CircleX, Inbox, Trash2, Star,
  NotebookPen, Play, SquareUser, ClipboardList, Move, Shuffle, Archive, Undo2, FileText, Image, Moon, Sun,
  Eye, EyeOff, Check, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Copy, Share, Send, Mic, Volume2,
  Pencil, RotateCcw, Users, Clock, Info, AlertTriangle, ArrowUp, ArrowDown, Search, Camera, type LucideIcon,
} from 'lucide-react'
import { Flag as FlagIcon } from 'lucide-react'
import { ChevronsUpDown } from 'lucide-react'

const map: Record<string, { icon: LucideIcon; fill?: boolean }> = {
  'xmark': { icon: X },
  'plus': { icon: Plus },
  'minus': { icon: Minus },
  'gearshape': { icon: Settings },
  'gearshape.fill': { icon: Settings },
  'square.and.arrow.down': { icon: Download },
  'square.and.arrow.up': { icon: Share },
  'sparkles': { icon: Sparkles },
  'questionmark.circle': { icon: CircleHelp },
  'questionmark.circle.fill': { icon: CircleHelp, fill: true },
  'plus.circle': { icon: CirclePlus },
  'plus.circle.fill': { icon: CirclePlus, fill: true },
  'xmark.circle': { icon: CircleX },
  'x.circle': { icon: CircleX },
  'tray': { icon: Inbox },
  'tray.full': { icon: Archive },
  'tray.full.fill': { icon: Archive, fill: true },
  'trash': { icon: Trash2 },
  'star.fill': { icon: Star, fill: true },
  'rectangle.and.pencil.and.ellipsis': { icon: NotebookPen },
  'play.fill': { icon: Play, fill: true },
  'person.2.crop.square.stack': { icon: SquareUser },
  'list.bullet.clipboard': { icon: ClipboardList },
  'arrow.up.and.down.and.arrow.left.and.right': { icon: Move },
  'shuffle': { icon: Shuffle },
  'arrow.uturn.backward': { icon: Undo2 },
  'doc.fill': { icon: FileText, fill: true },
  'photo': { icon: Image },
  'photo.fill': { icon: Image },
  'moon': { icon: Moon },
  'moon.fill': { icon: Moon, fill: true },
  'sun.min': { icon: Sun },
  'sun.min.fill': { icon: Sun, fill: true },
  'eye': { icon: Eye },
  'eye.slash': { icon: EyeOff },
  'checkmark': { icon: Check },
  'chevron.up': { icon: ChevronUp },
  'chevron.down': { icon: ChevronDown },
  'chevron.left': { icon: ChevronLeft },
  'chevron.right': { icon: ChevronRight },
  'doc.on.doc': { icon: Copy },
  'paperplane.fill': { icon: Send, fill: true },
  'mic': { icon: Mic },
  'speaker.wave.2': { icon: Volume2 },
  'pencil': { icon: Pencil },
  'arrow.counterclockwise': { icon: RotateCcw },
  'person.2': { icon: Users },
  'clock': { icon: Clock },
  'info.circle': { icon: Info },
  'exclamationmark.triangle': { icon: AlertTriangle },
  'arrow.up': { icon: ArrowUp },
  'arrow.down': { icon: ArrowDown },
  'magnifyingglass': { icon: Search },
  'camera': { icon: Camera },
  'chevron.up.chevron.down': { icon: ChevronsUpDown },
  'flag.fill': { icon: FlagIcon, fill: true },
  'sun.max.fill': { icon: Sun, fill: true },
}

/** SF Symbols 的 xxx.circle.fill：实心圆，里面的符号是镂空的 */
const circleFillGlyph: Record<string, string> = {
  'plus.circle.fill': 'M12 7v10M7 12h10',
  'xmark.circle.fill': 'M8.5 8.5l7 7M15.5 8.5l-7 7',
  'questionmark.circle.fill': 'M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2.6-3 4.2M12 17.4h.01',
  'minus.circle.fill': 'M7 12h10',
  'checkmark.circle.fill': 'M7.5 12.5l3 3 6-6.5',
}

function CircleFill({ glyph, size, color, stroke, style }: { glyph: string; size: number; color?: string; stroke: number; style?: React.CSSProperties }) {
  const id = 'sfmask' + useId().replace(/:/g, '')
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ flexShrink: 0, display: 'block', ...style }}>
      <mask id={id}>
        <rect width="24" height="24" fill="white" />
        <path d={glyph} stroke="black" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </mask>
      <circle cx="12" cy="12" r="11" fill={color ?? 'currentColor'} mask={`url(#${id})`} />
    </svg>
  )
}

const GEAR = 'M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915'

function GearFill({ size, color, style }: { size: number; color?: string; style?: React.CSSProperties }) {
  const id = 'sfgear' + useId().replace(/:/g, '')
  const c = color ?? 'currentColor'
  return (
    <svg width={size} height={size} viewBox="2 2 20 20" style={{ flexShrink: 0, display: 'block', overflow: 'visible', ...style }}>
      <mask id={id}>
        <rect x="0" y="0" width="24" height="24" fill="white" />
        <circle cx="12" cy="12" r="3.2" fill="black" />
      </mask>
      <path d={GEAR} fill={c} stroke={c} strokeWidth={1.6} strokeLinejoin="round" mask={`url(#${id})`} />
    </svg>
  )
}

export function SFIcon({ name, size = 20, color, weight = 'regular', style }: {
  name: string
  size?: number
  color?: string
  weight?: 'regular' | 'semibold' | 'bold' | 'black'
  style?: React.CSSProperties
}) {
  if (circleFillGlyph[name]) {
    const sw = weight === 'black' ? 3 : weight === 'bold' ? 2.6 : weight === 'semibold' ? 2.3 : 2.1
    return <CircleFill glyph={circleFillGlyph[name]} size={size} color={color} stroke={sw} style={style} />
  }
  if (name === 'gearshape.fill') {
    // 实心齿轮，中间挖一个圆孔（Lucide 只有空心的）
    return <GearFill size={size} color={color} style={style} />
  }
  if (name === 'xmark') {
    // Lucide 的 X 只占图标框的一半，SF Symbols 的 xmark 差不多占满，粗细也重得多
    const sw = weight === 'black' ? 3.6 : weight === 'bold' ? 3.1 : weight === 'semibold' ? 2.7 : 2.3
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" style={{ flexShrink: 0, display: 'block', ...style }}>
        <path d="M3.5 3.5l17 17M20.5 3.5l-17 17" stroke={color ?? 'currentColor'} strokeWidth={sw} strokeLinecap="round" fill="none" />
      </svg>
    )
  }
  const entry = map[name] ?? { icon: CircleHelp }
  const Icon = entry.icon
  const stroke = weight === 'black' ? 3 : weight === 'bold' ? 2.6 : weight === 'semibold' ? 2.2 : 1.9
  // Lucide 四周留了 2 的空白，图形只占框的 5/6；SF Symbols 基本占满。裁掉空白让大小对上，线宽相应调细
  return (
    <Icon
      size={size}
      viewBox="2 2 20 20"
      strokeWidth={stroke / 1.2}
      color={color ?? 'currentColor'}
      fill={entry.fill ? (color ?? 'currentColor') : 'none'}
      style={{ flexShrink: 0, display: 'block', overflow: 'visible', ...style }}
    />
  )
}
