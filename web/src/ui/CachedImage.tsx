// 角色图标，对应 iPad 版 CachedImageView。图片按原图比例缩放，加载不出来时显示问号
import { useState } from 'react'
import { SFIcon } from './SFIcon'

export function CachedImage({ url, size, style, grayscale }: {
  url: string
  size: number
  style?: React.CSSProperties
  grayscale?: boolean
}) {
  const [failed, setFailed] = useState(false)
  const box: React.CSSProperties = { width: size, height: size, flexShrink: 0, ...style }
  if (!url || failed) {
    return (
      // iPad 版的占位图是 resizable 的 questionmark.circle，撑满整个框，颜色就是前景色
      <div style={{ ...box, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <SFIcon name="questionmark.circle" size={size} />
      </div>
    )
  }
  return (
    <img
      src={url}
      alt=""
      draggable={false}
      referrerPolicy="no-referrer"
      loading="lazy"
      onError={() => setFailed(true)}
      // 块级显示：放在普通 div 里时不会因为基线在下面多出几像素
      style={{ display: 'block', ...box, objectFit: 'contain', filter: grayscale ? 'grayscale(1)' : undefined, pointerEvents: 'none' }}
    />
  )
}
