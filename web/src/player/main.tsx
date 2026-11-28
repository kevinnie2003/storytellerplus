// 说书人联机：玩家用的联机页面（online/index.html）
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../index.css'
import { PlayerApp } from './PlayerApp'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PlayerApp />
  </StrictMode>,
)
