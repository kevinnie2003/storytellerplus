//
//  TimerView.swift
//  说书人普拉斯
//
//  Created by Xuan Tang on 5/27/25.
//

import SwiftUI

struct TimerView: View{
  @Binding var gameState: Int
  @State private var gameStartTime = Date()
  @State private var currentDate = Date()
  @State private var dayTimeStart = Date()
  @State private var nightTimeStart = Date()
  @State private var timerTimeStart = Date() // for the timer
  @State private var previousTimerElapsed: TimeInterval = 0 // for the timer
  @State private var timerStopped = true // if we are using the timer
  /// 倒计时的秒数，0 表示正计时。长按计时器可以选
  @AppStorage("timer.countdownSeconds") private var countdownSeconds: Int = 0
  @State private var showCountdownPicker = false
  @State private var timeUp = false
  @State private var showCustomDuration = false
  @State private var customMinutes = ""
  @State private var flash = false
  let timer = Timer.publish(every: 1, on: .main, in: .common).autoconnect()
  private var timeElapsed: TimeInterval {
    currentDate.timeIntervalSince(gameStartTime)
  }
  private var timeElapsedDay: TimeInterval {
    currentDate.timeIntervalSince(dayTimeStart)
  }
  private var timeElapsedNight: TimeInterval {
     currentDate.timeIntervalSince(nightTimeStart)
  }
  
  private var timerElapsed: TimeInterval {
    previousTimerElapsed +
    ceil(currentDate.timeIntervalSince(timerTimeStart))
  }
  
  @State private var formatter = DateComponentsFormatter()
  
  private var currentTimerValue: TimeInterval {
    timerStopped ? previousTimerElapsed : timerElapsed
  }
  
  /// 计时器要显示的时间：正计时显示已过时间，倒计时显示剩余时间
  private var timerDisplay: TimeInterval {
    countdownSeconds > 0 ? max(0, Double(countdownSeconds) - currentTimerValue) : currentTimerValue
  }
  
  /// 选好倒计时就直接开始
  private func startCountdown(_ seconds: Int) {
    countdownSeconds = seconds
    resetTimer()
    timerTimeStart = Date()
    timerStopped = gameState == 0
  }
  
  private func resetTimer() {
    previousTimerElapsed = 0
    timerTimeStart = Date()
    timeUp = false
  }
  
  
  // Format time interval into HH:mm:ss
  func formattedTimeElapsed(timeElapsed: TimeInterval)-> String {
    return formatter.string(from: timeElapsed) ?? "00:00:00"
  }
  
  
  
  var body: some View{
    VStack{
      VStack{
        Text("游戏时长")
          .font(.system(size: 20, design: .rounded))
          .fontWeight(.bold)
          .foregroundColor(.ink)
        if gameState == 0 {
          Text("00:00:00")
            .font(.system(size: 18, design: .monospaced))
            .fontWeight(.semibold)
            .foregroundColor(.ink)
        }else{
          Text(formattedTimeElapsed(timeElapsed: timeElapsed))
            .font(.system(size: 18, design: .monospaced))
            .fontWeight(.semibold)
            .foregroundColor(.ink)
        }
      }
      .frame(maxHeight: .infinity)
      VStack{
        if gameState == 1 || gameState == 3{
          Text("夜晚时长")
            .font(.system(size: 20, design: .rounded))
            .fontWeight(.bold)
            .foregroundColor(.ink)
          Text(formattedTimeElapsed(timeElapsed: timeElapsedNight))
            .font(.system(size: 18, design: .monospaced))
            .fontWeight(.semibold)
            .foregroundColor(.ink)
        }else if gameState == 2 {
          Text("白天时长")
            .font(.system(size: 20, design: .rounded))
            .fontWeight(.bold)
            .foregroundColor(.ink)
          Text(formattedTimeElapsed(timeElapsed: timeElapsedDay))
            .font(.system(size: 18, design: .monospaced))
            .fontWeight(.semibold)
            .foregroundColor(.ink)
        }
      }
      .frame(maxHeight: .infinity)
      VStack{
        Text(countdownSeconds > 0 ? "倒计时" : "计时器")
          .font(.system(size: 20, design: .rounded))
          .fontWeight(.bold)
          .foregroundColor(.ink)
        if (gameState == 0){
          Text("00:00:00")
            .font(.system(size: 18, design: .monospaced))
            .fontWeight(.semibold)
            .foregroundColor(.ink)
        }else{
          Text(formattedTimeElapsed(timeElapsed: timerDisplay))
            .font(.system(size: 18, design: .monospaced))
            .fontWeight(.semibold)
            .foregroundColor(timeUp ? .white : .ink)
            .padding(.horizontal, 4)
            .background(RoundedRectangle(cornerRadius: 6).fill(timeUp && flash ? Color.demon : Color.clear))
        }
      }
      .onLongPressGesture(minimumDuration: 0.5) {
        showCountdownPicker = true
      }
      .confirmationDialog("计时器", isPresented: $showCountdownPicker) {
        Button("归零") { resetTimer(); timerStopped = true }
        Button("正计时") { countdownSeconds = 0; resetTimer(); timerStopped = true }
        ForEach([60, 120, 180, 300, 600], id: \.self) { seconds in
          Button("倒计时 \(seconds / 60) 分钟") { startCountdown(seconds) }
        }
        Button("自定义时长…") {
          customMinutes = ""
          showCustomDuration = true
        }
      } message: {
        Text("选好倒计时会直接开始。点一下暂停或继续，点两下归零")
      }
      .alert("倒计时多久？", isPresented: $showCustomDuration) {
        TextField("分钟，比如 1.5", text: $customMinutes)
          .keyboardType(.decimalPad)
        Button("取消", role: .cancel) {}
        Button("开始") {
          let minutes = Double(customMinutes.replacingOccurrences(of: "，", with: ".")) ?? 0
          let seconds = Int((minutes * 60).rounded())
          if seconds > 0 {
            startCountdown(min(seconds, 99 * 60))
          }
        }
      } message: {
        Text("输入分钟数，可以带小数")
      }
      .frame(maxHeight: .infinity)
    }
    .onReceive(timer) { date in
      currentDate = date
      // 倒计时到 0：停下并闪烁提醒
      if countdownSeconds > 0 && !timerStopped && timerElapsed >= Double(countdownSeconds) {
        previousTimerElapsed = Double(countdownSeconds)
        timerStopped = true
        timeUp = true
      }
      if timeUp {
        flash.toggle()
      }
    }
    .onChange(of: gameState) {_, newValue in
      if newValue == 1{
        gameStartTime = Date()
        nightTimeStart = gameStartTime
      }else if newValue == 2{
        dayTimeStart = Date()
      }else if newValue == 3 {
        nightTimeStart = Date()
      }
      timerStopped = true
      previousTimerElapsed = 0 // reset the timer when game state changes
      timeUp = false
    }
    // 双击要写在单击前面，否则单击会先把手势吃掉
    .onTapGesture(count: 2) {
      resetTimer()
    }
    .onTapGesture(count: 1) {
      if timeUp {
        // 时间到了，点一下归零
        resetTimer()
        timerStopped = true
        return
      }
      if timerStopped {
        timerTimeStart = Date()
        timerStopped = false
      }else{
        previousTimerElapsed = timerElapsed // record the previous elapsed time
        timerStopped = true
      }
    }
    .onAppear{
      formatter.allowedUnits = [.hour, .minute, .second]
      formatter.zeroFormattingBehavior = .pad
      if gameState != 0{
        gameStartTime = Date()
        if gameState == 1 || gameState == 3{
          nightTimeStart = gameStartTime
        }else{
          dayTimeStart = gameStartTime
        }
      }
      timerStopped = true
    }
    .animation(.easeInOut(duration: 0.3), value: gameState)
  }
}

#Preview{
  TimerView(gameState: .constant(1))
}
