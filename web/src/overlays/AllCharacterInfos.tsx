// 全部角色的能力，对应 SubViews/characterInfo/AllCharacterInfosView.swift（左右两边是首夜、其他夜晚的顺序）
import { useState } from 'react'
import type { Character, OrderInfo } from '../game/types'
import { game, setGame, useGame } from '../game/store'
import { demonInfo, minionInfo } from '../game/builtins'
import { CachedImage } from '../ui/CachedImage'
import { SFIcon } from '../ui/SFIcon'
import { rounded } from '../ui/kit'
import { OverlayLayer, SAFE_BOTTOM, SAFE_TOP, Spinner } from './common'
import { preloadImages, renderToPng, saveImages, timestampName } from './exportImage'

type ExportImages = Record<string, string> | null

/** 平时用 CachedImage；存图时用先下载好的图（下载不了就空着） */
function CharacterDisplayImage({ url, size, exportImages }: { url: string; size: number; exportImages: ExportImages }) {
  if (exportImages) {
    const data = exportImages[url]
    return data
      ? <img src={data} alt="" style={{ width: size, height: size, objectFit: 'contain', flexShrink: 0, display: 'block' }} />
      : <div style={{ width: size, height: size, flexShrink: 0 }} />
  }
  return <CachedImage url={url} size={size} />
}

function CharacterInfoCard({ character, color, exportImages }: { character: Character; color: string; exportImages: ExportImages }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, width: '100%' }}>
      <div style={{ padding: 16, flexShrink: 0 }}>
        <CharacterDisplayImage url={character.imageURL} size={40} exportImages={exportImages} />
      </div>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ ...rounded(25, 700), color }}>{character.name}</div>
        <div style={rounded(23, 600)}>{character.ability}</div>
      </div>
    </div>
  )
}

function CharacterRoleTitle({ letters, color, collapsed }: { letters: string[]; color: string; collapsed: boolean }) {
  // iPad 上在 ScrollView 里时，两栏角色的 layoutPriority 更高，竖排标题被挤成 0 宽看不见（只剩 8 的间距）；
  // 存成长图时（fixedSize）才显示出来
  if (collapsed) return <div style={{ width: 0, flexShrink: 0 }} />
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flexShrink: 0 }}>
      <div style={{ height: 8 }} />
      {letters.map((l, i) => <div key={i} style={{ ...rounded(30, 900), color, lineHeight: 1.2 }}>{l}</div>)}
      <div style={{ height: 8 }} />
    </div>
  )
}

function CharacterRoleSection({ letters, characters, color, exportImages }: {
  letters: string[]
  characters: Character[]
  color: string
  exportImages: ExportImages
}) {
  if (characters.length === 0) return null
  const middle = Math.ceil(characters.length / 2)
  const column = (list: Character[]) => (
    <div style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {list.map((c, i) => (
        <div key={`${c.id}-${i}`} style={{ paddingBottom: 10 }}>
          <CharacterInfoCard character={c} color={color} exportImages={exportImages} />
        </div>
      ))}
    </div>
  )
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <CharacterRoleTitle letters={letters} color={color} collapsed={!exportImages} />
        {characters.length === 1 ? column(characters) : (
          <>
            {column(characters.slice(0, middle))}
            {column(characters.slice(middle))}
          </>
        )}
      </div>
      <div style={{ padding: '30px 0' }}>
        <div style={{ height: 4, background: 'var(--ink)' }} />
      </div>
    </>
  )
}

function NightOrderColumn({ top, bottom, orders, exportImages }: {
  top: string
  bottom: string
  orders: OrderInfo[]
  exportImages: ExportImages
}) {
  return (
    <div style={{ width: 50, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
      <div style={{ height: 200, flexShrink: 0 }} />
      <div style={{ ...rounded(20, 900), marginBottom: -5 }}>{top}</div>
      <div style={rounded(20, 900)}>{bottom}</div>
      {orders.map((o, i) => (
        <CharacterDisplayImage key={i} url={o.imageURL} size={40} exportImages={exportImages} />
      ))}
      <div style={{ height: 8, flexShrink: 0 }} />
    </div>
  )
}

interface LayoutData {
  playableCharacters: Character[]
  travelersInPlay: Character[]
  fabledInPlay: Character[]
}

function nightOrders(playable: Character[]) {
  const pick = (first: boolean) => playable
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => (first ? c.firstNightOrder : c.otherNightOrder) !== 0 && c.team !== 'fabled' && c.team !== 'traveler')
    .map(({ c, i }): OrderInfo => ({
      order: first ? c.firstNightOrder : c.otherNightOrder,
      reminder: first ? c.firstNightReminder : c.otherNightReminder,
      playerID: i, imageURL: c.imageURL, characterName: c.name, team: c.team,
    }))
  const first = [...pick(true), minionInfo, demonInfo].sort((a, b) => a.order - b.order)
  const other = pick(false).sort((a, b) => a.order - b.order)
  return { first, other }
}

/** AllCharacterInfosLayout 的内容：宽 900 */
function LayoutContent({ data, exportImages }: { data: LayoutData; exportImages: ExportImages }) {
  const { playableCharacters: playable, travelersInPlay, fabledInPlay } = data
  const travelerNames = travelersInPlay.map((c) => c.name)
  const { first, other } = nightOrders(playable)
  const sections: [string[], Character[], string][] = [
    [['镇', '民'], playable.filter((c) => c.team === 'townsfolk'), 'var(--townsfolk)'],
    [['外', '来', '者'], playable.filter((c) => c.team === 'outsider'), 'var(--outsider)'],
    [['爪', '牙'], playable.filter((c) => c.team === 'minion'), 'var(--minion)'],
    [['恶', '魔'], playable.filter((c) => c.team === 'demon'), 'var(--demon)'],
    [['剧', '本', '传', '奇', '角', '色'], fabledInPlay, 'var(--fabled)'],
    [['剧', '本', '旅', '行', '者'], travelersInPlay, 'var(--traveler)'],
    [['官', '方', '旅', '行', '者'], playable.filter((c) => c.team === 'traveler' && !travelerNames.includes(c.name)), 'var(--traveler)'],
  ]
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, width: 900, color: 'var(--ink)' }}>
      <NightOrderColumn top="首个" bottom="夜晚" orders={first} exportImages={exportImages} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {sections.map(([letters, chars, color], i) => (
          <CharacterRoleSection key={i} letters={letters} characters={chars} color={color} exportImages={exportImages} />
        ))}
      </div>
      <NightOrderColumn top="其他" bottom="夜晚" orders={other} exportImages={exportImages} />
    </div>
  )
}

export function AllCharacterInfos() {
  const show = useGame((s) => s.showAllCharacterInfos)
  return show ? <AllCharacterInfosView /> : null
}

function AllCharacterInfosView() {
  const playableCharacters = useGame((s) => s.playableCharacters)
  const travelersInPlay = useGame((s) => s.travelers)
  const fabledInPlay = useGame((s) => s.fabled)
  const [isSavingImage, setIsSavingImage] = useState(false)
  const data = { playableCharacters, travelersInPlay, fabledInPlay }

  const saveAsImage = async () => {
    setIsSavingImage(true)
    try {
      const s = game()
      const exportData = { playableCharacters: s.playableCharacters, travelersInPlay: s.travelers, fabledInPlay: s.fabled }
      const urls = [
        ...s.playableCharacters.map((c) => c.imageURL),
        ...s.travelers.map((c) => c.imageURL),
        ...s.fabled.map((c) => c.imageURL),
        minionInfo.imageURL, demonInfo.imageURL,
      ]
      const images = await preloadImages(urls)
      const dataUrl = await renderToPng(
        <div style={{ width: 960, padding: '30px 30px', background: 'var(--mainbg)' }}>
          <LayoutContent data={exportData} exportImages={images} />
        </div>,
        960,
      )
      await saveImages([{ name: timestampName(s.playName ? `角色能力-${s.playName}` : '角色能力'), dataUrl }])
    } catch (e) {
      console.error('Failed to render all character infos image.', e)
    } finally {
      setIsSavingImage(false)
    }
  }

  return (
    // iPad 上背景 ignoresSafeArea 把整个 ZStack 撑满屏幕：右上角的按钮离屏幕顶 20，ScrollView 也铺满整屏、内容从安全区下面开始
    <OverlayLayer zIndex={15} background="var(--mainbg)" ignoresSafeArea onDoubleTapBackground={() => setGame({ showAllCharacterInfos: false })}>
      <div
        className="scroll-hidden"
        style={{
          position: 'relative', height: '100%', width: 960, padding: `${SAFE_TOP}px 30px ${SAFE_BOTTOM}px`, background: 'var(--mainbg)',
          overflowY: 'auto', overflowX: 'hidden',
        }}
      >
        <LayoutContent data={data} exportImages={null} />
      </div>
      <button
        onClick={saveAsImage}
        disabled={isSavingImage}
        style={{
          position: 'absolute', top: 20, right: 20, padding: 14, borderRadius: '50%',
          background: 'color-mix(in srgb, var(--paper) 55%, transparent)', backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)', color: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <span style={{ position: 'relative', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ opacity: isSavingImage ? 0 : 1 }}><SFIcon name="square.and.arrow.down" size={28} weight="semibold" /></span>
          {isSavingImage ? <span style={{ position: 'absolute' }}><Spinner /></span> : null}
        </span>
      </button>
    </OverlayLayer>
  )
}
