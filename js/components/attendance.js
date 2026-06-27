/**
 * attendance.js
 * 勤怠管理タブのUI描画とインタラクション制御
 */
import { db } from "../db.js";

class AttendanceComponent {
  constructor() {
    this.clockInterval = null;
  }

  // 初期化（タブ切り替え時に呼び出し）
  init() {
    this.setupElements();
    this.startClock();
    this.setupEventListeners();
    this.render();
  }

  // 終了処理（タブ変更時にタイマー停止など）
  destroy() {
    if (this.clockInterval) {
      clearInterval(this.clockInterval);
      this.clockInterval = null;
    }
  }

  setupElements() {
    this.clockEl = document.getElementById("digital-clock");
    this.dateEl = document.getElementById("digital-date");
    this.btnIn = document.getElementById("btn-clock-in");
    this.btnOut = document.getElementById("btn-clock-out");
    this.noteInput = document.getElementById("punch-note");
    
    this.todayInEl = document.getElementById("today-clock-in-time");
    this.todayOutEl = document.getElementById("today-clock-out-time");
    this.todayStatusBadge = document.getElementById("today-status-badge");
    
    this.historyTbody = document.getElementById("attendance-history-tbody");
  }

  // リアルタイムデジタル時計の更新
  startClock() {
    const updateTime = () => {
      const now = new Date();
      
      // 時刻文字列 (HH:MM:SS)
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      if (this.clockEl) {
        this.clockEl.textContent = `${hours}:${minutes}:${seconds}`;
      }

      // 日付文字列
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const date = String(now.getDate()).padStart(2, '0');
      const dayNames = ["日", "月", "火", "水", "木", "金", "土"];
      const day = dayNames[now.getDay()];
      if (this.dateEl) {
        this.dateEl.textContent = `${year}年${month}月${date}日 (${day})`;
      }
    };

    updateTime();
    this.clockInterval = setInterval(updateTime, 1000);
  }

  setupEventListeners() {
    // 出勤ボタン
    this.btnIn.onclick = async () => {
      try {
        const note = this.noteInput.value.trim();
        await db.clockIn(note);
        this.noteInput.value = "";
        
        // 成功エフェクトと再レンダリング
        this.showSuccessFeedback(this.btnIn);
        this.render();
      } catch (error) {
        alert(error.message);
      }
    };

    // 退勤ボタン
    this.btnOut.onclick = async () => {
      try {
        await db.clockOut();
        
        // 成功エフェクトと再レンダリング
        this.showSuccessFeedback(this.btnOut);
        this.render();
      } catch (error) {
        alert(error.message);
      }
    };
  }

  // ボタン押下時の簡易マイクロインタラクション
  showSuccessFeedback(button) {
    const originalText = button.querySelector("span").textContent;
    const originalIcon = button.querySelector(".punch-icon").innerHTML;
    
    button.style.transform = "scale(0.95)";
    button.querySelector("span").textContent = "打刻完了！";
    button.querySelector(".punch-icon").innerHTML = '<i class="fa-solid fa-check"></i>';
    
    setTimeout(() => {
      button.style.transform = "";
      button.querySelector("span").textContent = originalText;
      button.querySelector(".punch-icon").innerHTML = originalIcon;
    }, 2000);
  }

  // 描画処理
  async render() {
    const currentUser = db.getCurrentUser();
    if (!currentUser) return;

    // Row Owners フィルタリング済みの履歴リストを取得
    const history = await db.getAttendanceList();
    const todayStr = new Date().toISOString().split("T")[0];
    
    // 今日の打刻レコードを特定
    const todayRecord = history.find(item => item.date === todayStr);

    // 今日のステータス表示の更新
    if (todayRecord) {
      this.todayInEl.textContent = todayRecord.clockIn || "--:--";
      this.todayOutEl.textContent = todayRecord.clockOut || "--:--";
      
      if (todayRecord.clockIn && !todayRecord.clockOut) {
        this.todayStatusBadge.textContent = "勤務中";
        this.todayStatusBadge.className = "value badge active";
        
        // ボタンの活性化状態制御
        this.btnIn.disabled = true;
        this.btnIn.style.opacity = "0.5";
        this.btnIn.style.pointerEvents = "none";
        
        this.btnOut.disabled = false;
        this.btnOut.style.opacity = "1";
        this.btnOut.style.pointerEvents = "auto";
      } else if (todayRecord.clockIn && todayRecord.clockOut) {
        this.todayStatusBadge.textContent = "退勤済";
        this.todayStatusBadge.className = "value badge";
        
        this.btnIn.disabled = true;
        this.btnIn.style.opacity = "0.5";
        this.btnIn.style.pointerEvents = "none";
        this.btnOut.disabled = true;
        this.btnOut.style.opacity = "0.5";
        this.btnOut.style.pointerEvents = "none";
      }
    } else {
      this.todayInEl.textContent = "--:--";
      this.todayOutEl.textContent = "--:--";
      this.todayStatusBadge.textContent = "未打刻";
      this.todayStatusBadge.className = "value badge";
      
      this.btnIn.disabled = false;
      this.btnIn.style.opacity = "1";
      this.btnIn.style.pointerEvents = "auto";
      this.btnOut.disabled = true;
      this.btnOut.style.opacity = "0.5";
      this.btnOut.style.pointerEvents = "none";
    }

    // 履歴テーブルの描画
    this.historyTbody.innerHTML = "";
    if (history.length === 0) {
      this.historyTbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; color: var(--text-light); padding: 2rem;">
            打刻履歴がありません。
          </td>
        </tr>
      `;
      return;
    }

    history.forEach(item => {
      const row = document.createElement("tr");
      
      // 日付の日本語曜日付き表記に変換
      const dateObj = new Date(item.date);
      const dayNames = ["日", "月", "火", "水", "木", "金", "土"];
      const formattedDate = `${dateObj.getMonth() + 1}月${dateObj.getDate()}日 (${dayNames[dateObj.getDay()]})`;

      const statusHtml = item.clockOut 
        ? `<span class="status-indicator">勤務終了</span>`
        : `<span class="status-indicator success"><span class="status-dot"></span>勤務中</span>`;

      row.innerHTML = `
        <td>${formattedDate}</td>
        <td class="time-val">${item.clockIn || "--:--"}</td>
        <td class="time-val">${item.clockOut || "--:--"}</td>
        <td>${statusHtml}</td>
        <td class="text-muted" style="font-size: 0.85rem;">${item.note || "-"}</td>
      `;
      this.historyTbody.appendChild(row);
    });
  }
}

export const attendanceComponent = new AttendanceComponent();
