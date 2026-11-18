//
//  AIPrompts.swift
//  说书人普拉斯
//
//  提示词，以及把游戏状态整理成文字给模型看
//

import Foundation

func teamCN(_ team: String) -> String {
  switch team {
  case "townsfolk": return "镇民"
  case "outsider": return "外来者"
  case "minion": return "爪牙"
  case "demon": return "恶魔"
  case "traveler": return "旅行者"
  case "fabled": return "传奇角色"
  default: return team
  }
}

/// 当前游戏的快照，交给 AI 当上下文
struct AIGameContext {
  var playName: String = ""
  var gameState: Int = 0
  var playableCharacters: [Character] = []
  var players: [Character] = []
  var alive: [Bool] = []
  var deathVote: [Bool] = []
  var playerTags: [[Reminder]] = []
  var globalTags: [Reminder] = []
  var bluffs: [Character] = []
  var fabled: [Character] = []
  var jinxes: [Jinx] = []
  var logs: [GameLogEntry] = []
  var allReminders: [Reminder] = []
  var setupNotes: String = ""
}

enum AIPrompts {
  
  // MARK: 整理上下文
  
  /// 剧本里的角色列表（不含旅行者）
  static func scriptText(_ characters: [Character], includeTravelers: Bool = false) -> String {
    var lines: [String] = []
    for team in ["townsfolk", "outsider", "minion", "demon", "traveler"] {
      if team == "traveler" && !includeTravelers {
        continue
      }
      let list = characters.filter({ $0.team == team })
      if list.isEmpty {
        continue
      }
      lines.append("【\(teamCN(team))】")
      for c in list {
        lines.append("- \(c.name)\(c.setup ? "（影响配置）" : "")：\(c.ability)")
      }
    }
    return lines.joined(separator: "\n")
  }
  
  static func standardCounts(_ playerCount: Int) -> String {
    let n = min(max(playerCount, 5), 15)
    let c = teamCounts[n] ?? [0, 0, 0, 0, 0]
    return "镇民 \(c[0])、外来者 \(c[1])、爪牙 \(c[2])、恶魔 \(c[3])"
  }
  
  static func seatingText(_ ctx: AIGameContext) -> String {
    var lines: [String] = []
    for (i, c) in ctx.players.enumerated() {
      var line = "\(i + 1)号：\(c.name.isEmpty ? "未分配" : c.name)"
      if !c.team.isEmpty {
        line += "（\(teamCN(c.team))）"
      }
      if i < ctx.alive.count && ctx.gameState != 0 {
        if ctx.alive[i] {
          line += " 存活"
        } else {
          let hasVote = i < ctx.deathVote.count ? ctx.deathVote[i] : true
          line += " 死亡\(hasVote ? "" : "，已用掉死人票")"
        }
      }
      if i < ctx.playerTags.count && !ctx.playerTags[i].isEmpty {
        let tags = ctx.playerTags[i].map({ "\($0.from)·\($0.effect)\($0.isReversed ? "(倒置)" : "")" }).joined(separator: "、")
        line += " 标记：\(tags)"
      }
      lines.append(line)
    }
    return lines.joined(separator: "\n")
  }
  
  static func phaseText(_ ctx: AIGameContext) -> String {
    let day = ctx.logs.filter({ $0.type == 10 }).count
    switch ctx.gameState {
    case 0: return "配版中，游戏还没开始"
    case 1: return "首个夜晚"
    case 2: return "第 \(max(day, 1)) 个白天"
    case 3: return "第 \(day + 1) 个夜晚"
    default: return "未知"
    }
  }
  
  static func grimoireText(_ ctx: AIGameContext) -> String {
    var parts: [String] = []
    parts.append("剧本：\(ctx.playName)")
    parts.append("当前阶段：\(phaseText(ctx))")
    parts.append("座位顺序（环形，最后一位和 1 号相邻）：\n\(seatingText(ctx))")
    let bluffs = ctx.bluffs.filter({ !$0.name.isEmpty }).map({ $0.name })
    if !bluffs.isEmpty {
      parts.append("恶魔伪装：\(bluffs.joined(separator: "、"))")
    }
    if !ctx.globalTags.isEmpty {
      parts.append("全局标记：\(ctx.globalTags.map({ "\($0.from)·\($0.effect)" }).joined(separator: "、"))")
    }
    if !ctx.fabled.isEmpty {
      parts.append("传奇角色：\(ctx.fabled.map({ "\($0.name)（\($0.ability)）" }).joined(separator: "；"))")
    }
    if !ctx.jinxes.isEmpty {
      parts.append("相克和特殊规则：\n\(ctx.jinxes.map({ "- \($0.name)：\($0.description)" }).joined(separator: "\n"))")
    }
    return parts.joined(separator: "\n\n")
  }
  
  // MARK: AI 说书
  
  static func advisorSystem(_ ctx: AIGameContext) -> String {
    let logs = ctx.logs.suffix(80).map({ $0.logText }).joined(separator: "\n")
    return """
    你是血染钟楼（Blood on the Clocktower）线下局说书人的助手。说书人会在游戏进行中问你怎么带这一局，比如某个角色来问信息应该怎么给、醉酒或中毒的玩家给什么假信息、局势倾斜了怎么平衡、今晚谁该死。

    回答要求：
    - 简短。先给结论，再用一两句说明理由。整个回答控制在 150 字以内，最多 4 个要点，每个要点一行。说书人是在游戏中途看的，没时间读长文。
    - 问题范围很大时（比如问整晚的信息怎么给），只挑最需要说书人做决定的两三处来讲，照规则直接给真信息的角色不用提。说书人想知道更多会接着问。
    - 给具体可执行的建议，直接说给几号什么信息、怎么说，不要只讲原则。需要给出信息措辞时，直接写出可以对玩家说的原话。
    - 说书人的目标是让游戏有趣、让双方都有赢的机会，尽量让游戏走到最后一天。优势方可以给得保守一些，劣势方可以帮一把，但不能违反角色能力的规则。
    - 假信息要可信，能和场上已有的信息、邪恶方的伪装对上。
    - 严格依据下面剧本里的能力文字，这个剧本可能改过官方角色的能力，不要按你记忆里的官方版本回答。
    - 有多个合理选择时，推荐一个，最多再提一个备选。
    - 不要复述魔典内容。用中文回答，不要用 Markdown 标题和表格。

    下面是当前这一局的全部信息，只有说书人能看到。

    【剧本角色】
    \(scriptText(ctx.playableCharacters, includeTravelers: true))

    【魔典】
    \(grimoireText(ctx))

    【最近的游戏记录】
    \(logs.isEmpty ? "（还没有记录）" : logs)
    """
  }
  
  // MARK: AI 配版
  
  static let setupSystem = """
  你是血染钟楼（Blood on the Clocktower）的资深说书人，负责为一局线下游戏配版，也就是决定哪些角色牌放进抽卡堆。

  配版规则：
  - 抽卡堆的牌数必须等于需要的牌数，每名玩家抽一张。只能用给出的剧本里的镇民、外来者、爪牙、恶魔，角色名必须和剧本里的完全一致。
  - 先按标准人数配置，再按在场角色的能力调整。能力里方括号的说明（如 [+1 外来者]、[-1 外来者]）会改变各阵营数量，必须严格执行。
  - 有些角色“在场但不进抽卡堆”，要用别的牌代替，玩家抽完之后由说书人指定谁其实是这个角色：
    - 酒鬼这类“以为自己是镇民”的外来者：算一个外来者名额，但抽卡堆里放一张额外的镇民牌代替。
    - 提线木偶这类“以为自己是善良角色”的爪牙：算一个爪牙名额，但抽卡堆里放一张善良角色牌代替，之后要落在恶魔邻座。
    - 疯子这类“以为自己是恶魔”的外来者：算一个外来者名额，但抽卡堆里放一张额外的恶魔牌代替，所以抽卡堆里会有两张恶魔牌，抽完之后说书人决定哪一个是真恶魔、哪一个带“是疯子”标记。
    - 其他类似角色按它的能力文字同样处理。
  - 军团这类让多名玩家成为同一角色的恶魔：按它的能力文字放多张同名牌，并相应减少其他牌。
  - 抽卡堆允许出现重复的角色名，需要几张就写几次。
  - 以剧本里给出的能力文字为准，这个剧本可能改过官方能力。

  配版目标：
  - 相对平衡。善良方有足够的信息去解局，邪恶方有足够的伪装空间和干扰手段，不要一边倒。
  - 有趣。角色之间有配合和矛盾点，避免信息位全部互相印证导致两天就解完，也避免完全没有信息。
  - 说书人提出的诉求优先满足。诉求和规则冲突时按规则来，并在说明里讲清楚。

  只输出一个 JSON 对象，不要输出别的文字，格式：
  {
    "bag": ["角色名", "角色名"],
    "reasoning": "两三句话说明这套配版的思路和看点",
    "post_draw": ["玩家抽完卡之后说书人要做的事，每条一句话，没有就给空数组"]
  }
  """
  
  static func setupUser(characters: [Character], playerCount: Int, wish: String) -> String {
    let cards = min(playerCount, 15)
    var text = """
    玩家人数：\(playerCount) 人\(playerCount > 15 ? "（其中 \(playerCount - 15) 人是旅行者，不用你配）" : "")
    需要的牌数：\(cards) 张
    标准配置：\(standardCounts(playerCount))

    剧本角色：
    \(scriptText(characters))
    """
    let w = wish.trimmingCharacters(in: .whitespacesAndNewlines)
    if !w.isEmpty {
      text += "\n\n说书人的诉求：\(w)"
    }
    return text
  }
  
  // MARK: 抽卡后补完配版
  
  static let postDrawSystem = """
  你是血染钟楼（Blood on the Clocktower）的资深说书人。玩家已经抽完角色牌并入座，现在要完成剩下的配版工作：决定哪些玩家需要挂上开局标记。

  要处理的事：
  - 抽卡堆里用别的牌代替的角色，指定具体是谁。例如：哪个抽到镇民牌的玩家其实是酒鬼（挂“是酒鬼”）；哪个善良玩家其实是提线木偶（必须和恶魔邻座，挂“是提线木偶”）；两个抽到恶魔牌的玩家里谁是疯子（挂“是疯子”）。
  - 其他需要在开局确定的标记，例如占卜师的干扰项、调查员和洗衣妇这类首夜信息指向的玩家，前提是剧本里有这个角色并且有对应的标记。
  - 选三个不在场的善良角色作为恶魔伪装。
  - 选择时考虑平衡和趣味：酒鬼落在哪个镇民上对局势影响很大，尽量别废掉善良方唯一的强信息位，也别选完全没影响的位置。

  规则：
  - 座位是环形的，1 号和最后一号相邻。
  - 玩家编号用座位号。标记尽量从给出的可用标记里选，from 和 effect 要完全一致；确实没有合适的才自己起名。
  - 没有需要处理的就给空数组。只处理开局时要定下来的事，不要给游戏过程中才会出现的标记（如中毒、死亡）。
  - 以剧本里的能力文字为准。

  只输出一个 JSON 对象，不要输出别的文字，格式：
  {
    "tags": [{"player": 3, "from": "酒鬼", "effect": "是酒鬼", "reason": "一句话理由"}],
    "bluffs": ["角色名", "角色名", "角色名"],
    "notes": "一两句话的补充说明，没有就留空"
  }
  """
  
  static func postDrawUser(_ ctx: AIGameContext, wish: String) -> String {
    var seen = Set<String>()
    var tagLines: [String] = []
    for r in ctx.allReminders where r.team <= 3 {
      let key = "\(r.from)·\(r.effect)"
      if !seen.contains(key) {
        seen.insert(key)
        tagLines.append(key)
      }
    }
    var text = """
    座位和抽到的角色（环形）：
    \(seatingText(ctx))

    剧本角色：
    \(scriptText(ctx.playableCharacters))

    可用标记（角色·标记）：
    \(tagLines.joined(separator: "、"))
    """
    if !ctx.setupNotes.isEmpty {
      text += "\n\n配版时留下的待办：\n\(ctx.setupNotes)"
    }
    let w = wish.trimmingCharacters(in: .whitespacesAndNewlines)
    if !w.isEmpty {
      text += "\n\n说书人的诉求：\(w)"
    }
    return text
  }
  
  // MARK: 图片生成剧本 JSON
  
  static let scriptImportSystem = """
  你要把一张血染钟楼（Blood on the Clocktower）剧本图片转成可导入的自定义剧本 JSON。

  图片的结构：中间是按阵营分组的角色和能力；左右两侧各有一列小图标，左侧是首个夜晚的行动顺序，右侧是其他夜晚的行动顺序。

  一、读图。逐项照抄，以图为准，不要凭记忆替换成官方版本的文字，很多剧本会改动能力描述。
  - 剧本名、作者（“剧本作者：”后面的名字）。
  - 每个角色：名称、阵营（镇民 / 外来者 / 爪牙 / 恶魔 / 传奇角色 / 奇遇角色）、完整能力文字，包括方括号里的设置说明，如 [+1 外来者]。
  - 角色下方灰底的“相克规则”小字。
  - 顶部卷轴框里的剧本特殊规则（字很小，尽力辨认）。
  - 左侧图标列是首个夜晚顺序，右侧是其他夜晚顺序。把每个图标和正文里的角色图标对上。写着“爪”“魔”的圆形字是爪牙信息和恶魔信息，月亮和太阳是黄昏和黎明，它们都不是角色。
  - 页脚说明，如“某角色为可选角色”。

  二、输出一个 JSON 对象，不要输出别的文字：
  {
    "script": [ ... ],
    "notes": ["需要说书人核对的地方，每条一句话"]
  }

  script 是数组。第一项是：
  {"id": "_meta", "logo": "", "name": "剧本名", "author": "作者", "status": []}
  顶部卷轴框里的剧本特殊规则放进 status：[{"name": "规则标题", "skill": "规则全文"}]。

  其后每个角色一项，按 镇民 → 外来者 → 爪牙 → 恶魔 → 传奇/奇遇 的顺序：
  {
    "id": "<剧本拼音缩写>_<角色拼音>",
    "name": "角色名",
    "team": "townsfolk | outsider | minion | demon | fabled",
    "officialId": "",
    "image": "",
    "setup": false,
    "ability": "能力全文",
    "edition": "custom",
    "reminders": ["提醒标记"],
    "remindersGlobal": [],
    "firstNight": 0,
    "otherNight": 0,
    "firstNightReminder": "",
    "otherNightReminder": ""
  }

  字段规则：
  - id：用自定义 id，不要直接用官方英文 id。
  - officialId：如果这个角色是官方角色，或者明显是基于某个官方角色改的，填官方英文 id（小写加下划线，如 fortune_teller、scarlet_woman、imp），程序会用它去找图标。不确定或者是自创角色就留空字符串。image 一律留空，不要编造链接。
  - setup：能力里有方括号设置说明，或者像酒鬼、提线木偶、疯子那样影响开局配置时为 true。
  - firstNight / otherNight：不行动为 0，数值只表示先后。首夜里排在爪牙/恶魔信息之前的角色用 3.1、3.2、3.3……，之后的用 3100、3200、3300……。其他夜晚用 10、20、30……。顺序以图片两侧的图标列为准。侧边没有图标的角色两个夜晚都是 0，即使官方有夜晚行动。
  - firstNightReminder / otherNightReminder：给说书人看的夜晚提示语。官方角色用通行的提示语，能力被改过的按改后的能力写；自创角色按能力写，写法如“唤醒 X，让他选择一名玩家……”。不行动的留空。
  - reminders：这个角色会用到的提醒标记。官方角色用常见标记名（中毒、死亡、失去能力、醉酒、保护……），自创角色按能力起名。
  - remindersGlobal：像酒鬼、提线木偶、疯子这类“玩家以为自己是别的角色”的，把“是酒鬼”“是提线木偶”“是疯子”这样的标记放这里，而不是 reminders。
  - 相克规则：每条写成单独一项 {"id": "<剧本缩写>_jinx_<序号>", "name": "角色A & 角色B", "team": "a jinxed", "ability": "规则原文"}，放在数组最后。
  - 奇遇角色的 team 写 fabled。
  - “可选角色”在格式里没有对应字段，正常列入并在 notes 里说明。

  notes 只写真正不确定或需要核对的地方：辨认不清的小字、图上顺序和官方常见顺序不一致的位置、图上能力和官方版本不同的角色（已按图写）、你自己补写的提示语和提醒标记、officialId 留空的角色。
  """
  
  static func scriptImportUser(extra: String) -> String {
    let e = extra.trimmingCharacters(in: .whitespacesAndNewlines)
    return "请把这张剧本图片转成 JSON。" + (e.isEmpty ? "" : "\n补充说明：\(e)")
  }
}
