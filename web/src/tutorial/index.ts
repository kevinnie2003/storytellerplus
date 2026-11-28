// 新手教程入口：载入官方剧本《暗流涌动》，开一个演示小镇
import { useNav } from '../nav'
import { showAlert } from '../ui/Alert'

export async function startTutorial() {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}demo-trouble-brewing.json`)
    const items = (await res.json()) as Record<string, unknown>[]
    useNav.setState({ playJSON: items, loadLast: false, demo: true, viewNumber: 1 })
  } catch {
    showAlert({ title: '打不开新手教程', message: '读取演示剧本失败，请检查网络后再试。' })
  }
}
