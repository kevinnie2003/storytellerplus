//
//  PlayersCard.swift
//  说书人普拉斯
//
//  Created by Xuan Tang on 5/29/26.
//

import SwiftUI
import Flow

struct PlayerCard: View {
  let index: Int
  @Binding var playersAssignedCharacters: [Character]
  @Binding var reminders: [Reminder]
  let characters: [Character]
  let gameState: Int
  
  @Binding var currentSelectedPlayerID: Int
  @Binding var selectNewCharacter: Bool
  @Binding var currentSelectedPlayerIDForReminder: Int
  @Binding var selectNewReminder: Bool
  @Binding var selectedReminderIndex: Int
  @Binding var playersIsAlive: [Bool]
  @Binding var playersHasDeathVote: [Bool]
  @Binding var aliveCount: Int
  @Binding var allLogs: [GameLogEntry]
  @AppStorage(hideTeamColorsKey) private var hideTeamColors: Bool = false
  @ObservedObject private var appSettings = AppSettings.shared
  @State private var showDeathConfirm: Bool = false
  
  private func fontSize(_ base: CGFloat) -> CGFloat {
    (base * appSettings.cardFontScale).rounded()
  }
  
  /// 号码被点或被长按时：按设置决定是否先确认
  private func requestToggleAlive() {
    if gameState == 0 || index >= playersIsAlive.count {
      return
    }
    if appSettings.confirmDeath {
      showDeathConfirm = true
    } else {
      toggleAlive()
    }
  }
  
  private func toggleAlive() {
    TownActions.toggleAlive(index: index, players: playersAssignedCharacters, alive: $playersIsAlive, deathVote: $playersHasDeathVote, aliveCount: $aliveCount, logs: $allLogs)
  }

  func tagColor(_ team: Int) -> Color {
    return hideTeamColors ? Color.neutralTeam : teamid2Color(team)
  }
  var teamColorMain: Color {
    let character = playersAssignedCharacters[index]
    if hideTeamColors && isPlayerTeam(character.team) {
      return Color.neutralTeam
    }
    if character.team == "minion"{
      return Color.minion
    }else if character.team == "demon"{
      return Color.demon
    } else if character.team == "townsfolk"{
      return Color.townsfolk
    } else if character.team == "outsider"{
      return Color.outsider
    } else if character.team == "traveler"{
      return Color.traveler
    }
    return Color.mainbg
  }
  
  var teamColorSecondary: Color {
    let character = playersAssignedCharacters[index]
    if character.team == "minion"{
      return Color.evilTextBg
    }else if character.team == "demon"{
      return Color.evilTextBg
    }else if character.team == "townsfolk"{
      return Color.goodTextBg
    } else if character.team == "outsider"{
      return Color.goodTextBg
    } else if character.team == "traveler"{
      return Color.goodTextBg
    }
    return Color.black
  }
  
  
  var body: some View {
    
    if index >= playersAssignedCharacters.count {
      Color.clear.frame(maxWidth: .infinity)
    }else{
      let character = playersAssignedCharacters[index]
      VStack(spacing: 0){
        VStack {
          HStack {
            Text("\(index + 1)")
              .font(.system(size: fontSize(25), design: .rounded))
              .fontWeight(.black)
              .foregroundColor(teamColorMain)
              .frame(width: appSettings.cardsPerRow >= 4 ? 40 : 50, height: appSettings.cardsPerRow >= 4 ? 40 : 50, alignment: .center)
              .background(Circle()
                .fill(teamColorSecondary)
              )
              .overlay(
                Image(systemName: "xmark")
                  .font(.system(size: 45, weight: .black))
                  .foregroundColor(.demon)
                  .opacity(index >= playersIsAlive.count ? 0.0 : (playersIsAlive[index] ? 0.0 : 1))
              )
              // 按设置：点一下或者长按号码切换死亡/复活
              .modifier(SeatNumberGesture(byTap: appSettings.deathByTap, seconds: appSettings.deathLongPressSeconds, action: requestToggleAlive))
              .alert(index < playersIsAlive.count && playersIsAlive[index] ? "让 \(index + 1) 号死亡吗？" : "让 \(index + 1) 号复活吗？", isPresented: $showDeathConfirm) {
                Button("取消", role: .cancel) {}
                Button("确定", role: .destructive) {
                  toggleAlive()
                }
              }
              .padding(.leading, 5)
            Text(character.name)
              .font(.system(size: fontSize(22), design: .rounded))
              .fontWeight(.bold)
              .foregroundColor(teamColorSecondary)
              .padding(.horizontal, 5)
              .lineLimit(1)
              .minimumScaleFactor(0.5)
              .frame(maxWidth: .infinity, alignment: .leading)
            if hideTeamColors && isPlayerTeam(character.team) {
              Text(teamShortName(character.team))
                .font(.system(size: 15, design: .rounded))
                .fontWeight(.bold)
                .foregroundColor(teamColorSecondary.opacity(0.45))
                .frame(width: 18)
            }
            CachedImageView(urlString: character.imageURL)
              .grayscale(hideTeamColors ? 1 : 0)
              .frame(width: appSettings.cardsPerRow >= 4 ? 40 : 50, height: appSettings.cardsPerRow >= 4 ? 40 : 50)
              .background(Circle()
                .fill(teamColorSecondary)
              )
              .padding(.trailing, 5)
              .onTapGesture {
                currentSelectedPlayerID = index
                selectNewCharacter = true
              }
          }
          .padding(.top, 20)
          Text(character.ability)
            .font(.system(size: fontSize(18), design: .rounded))
            .fontWeight(.semibold)
            .foregroundColor(teamColorSecondary.opacity(1))
            .padding(.horizontal, 5)
            .frame(maxHeight: .infinity, alignment: .top)
            .padding(.top, 5)
            .padding(.bottom, 20)
        }// end of the character info view, the next is the reminder/status
        .background(teamColorMain)
        .clipShape(.rect(
          topLeadingRadius: 20,
          bottomLeadingRadius: 0,
          bottomTrailingRadius: 0,
          topTrailingRadius: 20
        )
        )
        .opacity(index >= playersIsAlive.count ? 0.0 : (playersIsAlive[index] ? 1.0 : 0.5))
        HFlow {
          ForEach(reminders.indices, id: \.self) { reminderIndex in
            let reminder = reminders[reminderIndex]
            HStack(spacing: 0) {
              let imageURL = getImageURL(name: reminder.from, characters: characters)
              HStack(spacing: 0){
                if reminder.playerId >= 0 {
                  Text("\(reminder.playerId + 1)")
                    .font(.system(size: fontSize(18), design: .rounded))
                    .fontWeight(.black)
                    .foregroundColor(tagColor(reminder.team))
                    .frame(minWidth: 24)
                    .frame(height: 36)
//                      .background(Circle().fill(Color.goodTextBg).frame(width: 45, height: 45))
                }
                if !imageURL.isEmpty {
                  CachedImageView(urlString: imageURL)
                    .grayscale(hideTeamColors ? 1 : 0)
                    .frame(width: 35, height: 35)
                    .background(Circle().fill(Color.goodTextBg))
                  
                }else{
                  Color.clear
                    .frame(width: 0, height: 36)
                }
              }
              .padding(.leading, (reminder.playerId >= 0) ? 3: 0)
              .background(RoundedRectangle(cornerRadius: 20).fill(Color.goodTextBg))
              .padding(.trailing, (reminder.playerId >= 0 || imageURL != "") ? 2: 0)
              Text(reminder.effect)
                .font(.system(size: fontSize(18), design: .rounded))
                .fontWeight(.bold)
                .foregroundColor(.goodTextBg)
                .padding(.horizontal, 5)
            }
            .frame(minWidth: 50)
            .frame(height: 42)
            .padding(.horizontal, 3)
            .background(RoundedRectangle(cornerRadius: 20)
              .fill(tagColor(reminder.team)))
            .rotationEffect(reminder.isReversed ? .degrees(180) : .degrees(0))
            .onTapGesture(count: 2){
              // remove this reminder
              let entry = GameLogEntry(message: "\(reminder.effect)", messager: index + 1, source: reminder.from, type: 14, characterName: character.name, playerNumbers: [index + 1], playerCharacters: [character.name, reminder.from], playerTeams: [team2Int(character.team), reminder.team])
              TownActions.removeReminder(at: reminderIndex, from: $reminders, logEntry: entry, logs: $allLogs, label: "\(index + 1) 号的标签")
            }
            .onLongPressGesture(minimumDuration: 1){
              withAnimation(.easeInOut(duration: 0.3)) {
                reminders[reminderIndex].isReversed.toggle()
                allLogs.append(GameLogEntry(message: "\(reminder.effect)", messager: index + 1, source: reminder.from, type: 15, characterName: character.name, playerNumbers: [index + 1], playerCharacters: [character.name, reminder.from], playerTeams: [team2Int(character.team), reminder.team]))
              }
            }
          }
          Button(action: {
            currentSelectedPlayerIDForReminder = index
            selectNewReminder = true
            selectedReminderIndex = -1
          }) {
            Image(systemName: "plus")
              .font(.system(size: 25, weight: .bold))
              .foregroundColor(.black)
              .frame(width: 35, height: 35)
              .overlay(Circle().stroke(Color.black, lineWidth: 3))
          }
          .contentShape(Circle())
        }
        .padding(.top, 10)
        .padding(.horizontal, 5)
        .padding(.bottom, 10)
        .frame(maxWidth: .infinity)
        .background(.mainbg)
        .clipShape(.rect(
          topLeadingRadius: 0,
          bottomLeadingRadius: 20,
          bottomTrailingRadius: 20,
          topTrailingRadius: 0
        )
        )
        .animation(.easeInOut(duration: 0.3), value: reminders.count)
      }
      .frame(maxWidth: .infinity)
    }
  }
}

/// 号码的手势：点一下，或者长按指定秒数
struct SeatNumberGesture: ViewModifier {
  let byTap: Bool
  let seconds: Double
  let action: () -> Void
  
  func body(content: Content) -> some View {
    if byTap {
      content.onTapGesture(perform: action)
    } else {
      content.onLongPressGesture(minimumDuration: seconds, perform: action)
    }
  }
}
