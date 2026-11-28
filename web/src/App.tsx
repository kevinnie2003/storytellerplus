// 对应 iPad 版 ContentView：开始页和小镇两个画面
import { useEffect } from 'react'
import { useSettings, isDarkNow } from './settings/store'
import { AlertHost } from './ui/Alert'
import { StartScreen } from './screens/StartScreen'
import { TownScreen } from './screens/TownScreen'

export { useNav, type AppNav } from './nav'
import { useNav } from './nav'

export default function App() {
  const viewNumber = useNav((s) => s.viewNumber)
  const appearance = useSettings((s) => s.appearance)
  const gameIsNight = useSettings((s) => s.gameIsNight)
  const dark = isDarkNow({ appearance, gameIsNight })
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  }, [dark])
  return (
    <>
      {viewNumber === 0 ? <StartScreen /> : <TownScreen />}
      <AlertHost />
    </>
  )
}
