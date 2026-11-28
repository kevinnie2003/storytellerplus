// 说书人普肉：玩家用的联机页面（pro/index.html）
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../index.css'
import { PlayerApp } from './PlayerApp'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PlayerApp />
  </StrictMode>,
)
