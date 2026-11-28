// 演示小镇里的新手教程。由 TownScreen 在 useNav.demo 为 true 时挂上
import { useEffect, useMemo, useState } from 'react'
import { useNav } from '../nav'
import { useSettings } from '../settings/store'
import { setGame } from '../game/store'
import { TourOverlay } from './TourOverlay'
import { finishDemoState, setupDemo, tourSteps } from './demo'

export function DemoTour() {
  const [ready, setReady] = useState(false)
  // 小镇先按剧本读完（TownScreen 的 onAppear），再摆成空的 8 人演示局
  useEffect(() => {
    const t = window.setTimeout(() => { setupDemo(); setReady(true) }, 80)
    return () => window.clearTimeout(t)
  }, [])
  const steps = useMemo(() => tourSteps(), [])
  if (!ready) return null
  const finish = () => {
    finishDemoState()
    useSettings.getState().set('tutorialSeen', true)
    setGame({ showSetup: false, showNotepad: false, showConversation: false, selectNewReminder: false, selectNewCharacter: false, showMenu: false })
    useNav.setState({ viewNumber: 0, demo: false })
  }
  return <TourOverlay steps={steps} onFinish={finish} />
}
