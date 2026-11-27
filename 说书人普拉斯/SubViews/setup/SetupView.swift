//
//  SetupView.swift
//  说书人普拉斯
//
//  Created by Xuan Tang on 6/29/25.
//

import SwiftUI
import Flow

struct SetupView: View {
  @Environment(\.colorScheme) private var colorScheme
  @Binding var playableCharacters: [Character]
  @Binding var playersAssignedCharacters: [Character]
  @Binding var playerCount: Int
  
  @Binding var showSetup: Bool
  @Binding var aiSetupNotes: String
  @Binding var openAISetupOnAppear: Bool // 从主界面点“AI 配版”进来时，直接弹出 AI 配版
  @State private var showAISetup: Bool = false
  @State private var badDeckCount: Int? = nil
  /// 新手教程用：告诉外面现在配到哪一步，也可以从外面直接塞一套抽卡堆或者跳到某一步
  var onStage: (Int) -> Void = { _ in }
  var demoBag: Binding<[Character]?> = .constant(nil)
  var demoStage: Binding<Int?> = .constant(nil)
  let startDate = Date() // for the animation effect
  @State private var selectionState: Int = 0 // 0 for choosing number of demon, 1 for letting user choose demon, 2 for show demon, 3 for selecting number of minions, 4 for letting user choose minions, 5 for show minions, 6 for selecting number of outsiders, 7 for letting user choose outsiders, 8 for show outsiders, 9 for selecting number of townsfolk, 10 for letting user choose townsfolk, 11 for show townsfolk, then 12 for letting user pick the actual characters 1 by 1
  @State private var selectedCharacters: [Character] = []
  @State private var selectedTeamCounts: [Int] = [0, 0, 0, 0] // [demon, minion, outsider, townsfolk]
  @State private var cardSelected: [Bool] = [] // just placeholders
  @State private var playableCharactersShuffled: [Character] = []
  @State private var extraRepeatedCharacters: [Character] = [] // for repeated characters
  @State private var extraRepeatedCardSelected: [Bool] = []
  @State private var playerChoices: [Int] = []
  let teamNames = ["恶魔", "爪牙", "外来者", "镇民"]
  let teamNameEnglish = ["demon", "minion", "outsider", "townsfolk"]
  let teamColors: [Color] = [.demon, .minion, .outsider, .townsfolk]
  var body: some View{
    ZStack{
      // setup the background color effect
      Color.white
        .colorEffect(ShaderLibrary.dotPatternShader(
          .float(80),
          .float(1),
          .float(0),
          .float(colorScheme == .dark ? 1 : 0)))
        .edgesIgnoringSafeArea(.all)
      
      
      Group{
        if selectionState == 0 || selectionState == 3 || selectionState == 6 || selectionState == 9{
          HStack{
            SetupCount(playerCount: $playerCount, selectionState: $selectionState, selectedTeamCounts: $selectedTeamCounts)
              .frame(maxWidth: .infinity, alignment: .center)
            
            ExtraSetupForSetup(playableCharacters: $playableCharacters, selectedCharacters: $selectedCharacters, selectionState: $selectionState, showSetup: $showSetup)
          }
        }
      }// end of group 1
      Group{
        if selectionState == 1 || selectionState == 4 || selectionState == 7 || selectionState == 10{
          SetupBlindPick(playableCharactersShuffled: $playableCharactersShuffled, selectedTeamCounts: $selectedTeamCounts, cardSelected: $cardSelected, selectionState: $selectionState)
            .frame(maxHeight: .infinity)
        }
      }
      Group{
        if selectionState == 2 || selectionState == 5 || selectionState == 8 || selectionState == 11{
          HStack{
            SetupCheck(playableCharacters: $playableCharacters, playableCharactersShuffled: $playableCharactersShuffled, cardSelected: $cardSelected, extraRepeatedCharacters: $extraRepeatedCharacters, extraRepeatedCardSelected: $extraRepeatedCardSelected, playerCount: $playerCount, selectionState: $selectionState)
              .frame(maxWidth: .infinity, alignment: .center)
            ExtraSetupForSetup(playableCharacters: $playableCharacters, selectedCharacters: $selectedCharacters, selectionState: $selectionState, showSetup: $showSetup)
          }
        }
      }
      Group{
        if selectionState == 12{
          SetupPlayerPick(playableCharactersShuffled: $playableCharactersShuffled, playersAssignedCharacters: $playersAssignedCharacters, extraRepeatedCharacters: $extraRepeatedCharacters,cardSelected: $cardSelected, extraRepeatedCardSelected: $extraRepeatedCardSelected, playerChoices: $playerChoices, selectionState: $selectionState, showSetup: $showSetup)
        }
      }
      
    }
    .overlay(alignment: .topLeading) {
      if selectionState < 12 {
        Button(action: { showAISetup = true }) {
          HStack(spacing: 6) {
            Image(systemName: "sparkles")
            Text("AI 配版")
          }
          .font(.system(size: 20, weight: .bold, design: .rounded))
          .foregroundColor(.ink)
          .padding(.horizontal, 18)
          .padding(.vertical, 12)
          .background(Color.paper)
          .cornerRadius(30)
          .overlay(RoundedRectangle(cornerRadius: 30).stroke(Color.ink, lineWidth: 3))
        }
        .padding(20)
      }
    }
    .sheet(isPresented: $showAISetup) {
      AISetupSheet(playableCharacters: playableCharacters, playerCount: playerCount) { bag, notes in
        applyAIBag(bag, notes: notes)
      }
    }
    .onAppear{
      onStage(selectionState)
      playableCharactersShuffled = playableCharacters.shuffled()
      for _ in 0..<playableCharactersShuffled.count {
        cardSelected.append(false) // initialize the selection state
      }
      for _ in 0..<playerCount {
        playerChoices.append(-1) // initialize the player choices
      }
      if openAISetupOnAppear {
        openAISetupOnAppear = false
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) {
          showAISetup = true
        }
      }
    }
    .animation(.easeInOut(duration: 0.5), value: selectionState)
    .animation(.easeInOut(duration: 0.5), value: showSetup)
    .onChange(of: selectionState) { old, value in
      // 抽卡堆的牌数要等于人数才能开抽，不然抽卡页没有牌可抽
      if value == 12 && old != 12 {
        let count = cardSelected.filter({ $0 }).count + extraRepeatedCardSelected.filter({ $0 }).count
        if count != playerCount {
          badDeckCount = count
          selectionState = old
          return
        }
      }
      onStage(value)
    }
    .alert("牌数不对，还不能开抽", isPresented: Binding(get: { badDeckCount != nil }, set: { if !$0 { badDeckCount = nil } })) {
      Button("好", role: .cancel) {}
    } message: {
      Text("抽卡堆现在有 \(badDeckCount ?? 0) 张牌，玩家有 \(playerCount) 人。在检查页点牌选中或去掉，让牌数和人数一样再点“玩家开抽”。")
    }
    .onChange(of: demoBag.wrappedValue) { _, bag in
      if let bag = bag {
        applyAIBag(bag, notes: "")
        demoBag.wrappedValue = nil
      }
    }
    .onChange(of: demoStage.wrappedValue) { _, stage in
      if let stage = stage {
        selectionState = stage
        demoStage.wrappedValue = nil
      }
    }
  }
  
  // 把 AI 给的抽卡堆填进配版，然后跳到检查页让说书人确认
  private func applyAIBag(_ bag: [Character], notes: String) {
    for i in cardSelected.indices {
      cardSelected[i] = false
    }
    extraRepeatedCharacters = []
    extraRepeatedCardSelected = []
    for character in bag {
      if let index = playableCharactersShuffled.indices.first(where: { playableCharactersShuffled[$0] == character && !cardSelected[$0] }) {
        cardSelected[index] = true
      } else {
        // 同一个角色出现多次，走“重复角色”
        extraRepeatedCharacters.append(character)
        extraRepeatedCardSelected.append(true)
      }
    }
    selectedTeamCounts = teamNameEnglish.map { team in bag.filter({ $0.team == team }).count }
    aiSetupNotes = notes
    selectionState = 11
  }
}
