// 手机版的“信息”页：大屏右边和中间那几块（局势、恶魔伪装、传奇角色、相克和提名提示）放到一页里
import { setGame, useGame } from '../game/store'
import { defaultCharacter, type Character } from '../game/types'
import { openCharacterSelection } from '../game/actions'
import { CachedImage } from '../ui/CachedImage'
import { SFIcon } from '../ui/SFIcon'
import { usePress } from '../ui/gestures'
import { rounded } from '../ui/kit'
import { PlayInfo, SurvivorInfo, TeamActualInfo, TeamInfo } from '../town/Infos'
import { ExtraCareView } from '../panels/ExtraCareView'
import { MobilePage } from './MobilePage'

const box: React.CSSProperties = {
  background: 'var(--mainbg)', borderRadius: 14, outline: '3px solid var(--ink)', outlineOffset: -1.5, overflow: 'hidden',
}
const heading: React.CSSProperties = { ...rounded(18, 900), lineHeight: 1.2, padding: '0 4px' }

function Bluffs() {
  const bluffs = useGame((s) => s.notPresentedGoodCharacters)
  const assigned = useGame((s) => s.playersAssignedCharacters)
  const names = new Set(assigned.map((c) => c.name))
  return (
    <div data-tour="bluffs" style={{ ...box, display: 'flex', justifyContent: 'space-around', padding: '12px 6px' }}>
      {[0, 1, 2].map((index) => {
        const c = index < bluffs.length ? bluffs[index] : defaultCharacter
        return (
          <button
            key={index}
            onClick={() => openCharacterSelection(index + 21)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: 6, borderRadius: 10, width: '30%', color: 'var(--ink)',
              outline: names.has(c.name) ? '3px solid var(--warningRed)' : 'none', outlineOffset: -1.5,
            }}
          >
            <CachedImage url={c.imageURL} size={54} />
            <span style={{ ...rounded(14, 700), lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{c.name || '点选'}</span>
          </button>
        )
      })}
    </div>
  )
}

function FabledItem({ character }: { character: Character }) {
  const press = usePress({
    onDoubleTap: () => setGame((s) => ({ selectedFabledCharacters: s.selectedFabledCharacters.filter((c) => c.id !== character.id) })),
  })
  return (
    <div {...press} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 76, flexShrink: 0, cursor: 'pointer' }}>
      <CachedImage url={character.imageURL} size={56} />
      <div style={{ ...rounded(13, 700), lineHeight: 1.2, textAlign: 'center' }}>{character.name}</div>
    </div>
  )
}

function Fabled() {
  const selected = useGame((s) => s.selectedFabledCharacters)
  return (
    <div data-tour="fabled" className="scroll-hidden" style={{ ...box, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', overflowX: 'auto' }}>
      {selected.map((c) => <FabledItem key={c.id} character={c} />)}
      <button
        aria-label="加传奇角色"
        onClick={() => setGame({ showFabledCharactersSelection: true })}
        style={{
          width: 46, height: 46, borderRadius: '50%', background: 'var(--ink)', color: 'var(--mainbg)', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <SFIcon name="plus" size={30} weight="bold" />
      </button>
      {selected.length === 0 ? <span style={{ ...rounded(14, 600), opacity: 0.6 }}>还没有传奇角色</span> : null}
      {selected.length > 0 ? <span style={{ ...rounded(12, 600), opacity: 0.5, flexShrink: 0 }}>双击删除</span> : null}
    </div>
  )
}

export function InfoPage({ onClose }: { onClose: () => void }) {
  return (
    <MobilePage title="信息" onClose={onClose} zIndex={60} bodyStyle={{ padding: '14px 12px calc(20px + env(safe-area-inset-bottom))', gap: 18 }}>
      <div data-tour="info" style={{ ...box, display: 'flex', flexDirection: 'column', gap: 4, padding: '12px 14px' }}>
        <PlayInfo />
        <TeamInfo />
        <TeamActualInfo />
        <SurvivorInfo />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={heading}>恶魔伪装</div>
        <Bluffs />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={heading}>传奇角色</div>
        <Fabled />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={heading}>相克和提示</div>
        <div data-tour="extraCare" style={{ ...box, height: 420, flexShrink: 0 }}>
          <ExtraCareView />
        </div>
      </div>

      <button
        data-tour="menu.infos"
        onClick={() => setGame({ showAllCharacterInfos: true })}
        style={{ ...box, display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', color: 'var(--ink)', background: 'var(--paper)' }}
      >
        <SFIcon name="person.2.crop.square.stack" size={24} />
        <span style={{ ...rounded(17, 800), flex: 1, textAlign: 'left' }}>全部角色能力</span>
        <SFIcon name="chevron.right" size={20} weight="bold" />
      </button>
    </MobilePage>
  )
}
