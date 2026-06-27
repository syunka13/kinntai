/**
 * calendar.js
 * 予定管理（カレンダー）タブのUI描画とスケジュール管理
 */
import { db } from "../db.js";

class CalendarComponent {
  constructor() {
    this.currentDate = new Date(); // 現在表示している年月
    this.selectedDate = new Date(); // ユーザーがクリック選択した日付
    this.scheduleData = []; // ロードされたスケジュールリスト
  }

  init() {
    this.setupElements();
    this.setupEventListeners();
    this.render();
  }

  destroy() {
    // クリーンアップ
  }

  setupElements() {
    this.monthYearLabel = document.getElementById("calendar-month-year");
    this.daysGrid = document.getElementById("calendar-days-grid");
    this.btnPrevMonth = document.getElementById("btn-prev-month");
    this.btnNextMonth = document.getElementById("btn-next-month");
    
    this.selectedDateLabel = document.getElementById("selected-date-label");
    this.selectedDayScheduleList = document.getElementById("selected-day-schedule-list");
    this.btnOpenModal = document.getElementById("btn-open-schedule-modal");
    
    // モーダル要素
    this.modal = document.getElementById("schedule-form-modal");
    this.modalClose = document.getElementById("btn-close-schedule-modal");
    this.form = document.getElementById("schedule-form");
    this.btnCancel = document.getElementById("btn-cancel-schedule");
    
    this.titleInput = document.getElementById("sch-title");
    this.descInput = document.getElementById("sch-description");
    this.startInput = document.getElementById("sch-start");
    this.endInput = document.getElementById("sch-end");
    this.isGlobalInput = document.getElementById("sch-is-global");
  }

  setupEventListeners() {
    // 前月・翌月移動
    this.btnPrevMonth.onclick = () => {
      this.currentDate.setMonth(this.currentDate.getMonth() - 1);
      this.render();
    };

    this.btnNextMonth.onclick = () => {
      this.currentDate.setMonth(this.currentDate.getMonth() + 1);
      this.render();
    };

    // モーダル開閉
    this.btnOpenModal.onclick = () => {
      this.openScheduleModal();
    };

    this.modalClose.onclick = () => {
      this.closeScheduleModal();
    };

    this.btnCancel.onclick = () => {
      this.closeScheduleModal();
    };

    // フォーム送信
    this.form.onsubmit = async (e) => {
      e.preventDefault();
      
      const title = this.titleInput.value.trim();
      const description = this.descInput.value.trim();
      const startTime = this.startInput.value;
      const endTime = this.endInput.value;
      const isGlobal = this.isGlobalInput.checked;

      if (!title || !startTime || !endTime) return;

      try {
        await db.addSchedule(title, description, startTime, endTime, isGlobal);
        this.closeScheduleModal();
        await this.render(); // カレンダーとリストを再描画
      } catch (error) {
        alert("予定の保存に失敗しました: " + error.message);
      }
    };
  }

  openScheduleModal() {
    // 選択されている日付を初期入力値として設定
    const year = this.selectedDate.getFullYear();
    const month = String(this.selectedDate.getMonth() + 1).padStart(2, '0');
    const day = String(this.selectedDate.getDate()).padStart(2, '0');
    
    // 現在の時分を初期値に設定
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const mins = String(now.getMinutes()).padStart(2, '0');
    
    const formattedDateTime = `${year}-${month}-${day}T${hours}:${mins}`;
    const oneHourLater = `${year}-${month}-${day}T${String(now.getHours() + 1).padStart(2, '0')}:${mins}`;

    this.startInput.value = formattedDateTime;
    this.endInput.value = oneHourLater;
    this.titleInput.value = "";
    this.descInput.value = "";
    this.isGlobalInput.checked = false;

    this.modal.classList.remove("hidden");
    this.modal.classList.add("active");
  }

  closeScheduleModal() {
    this.modal.classList.add("hidden");
    this.modal.classList.remove("active");
  }

  // 描画処理
  async render() {
    // Row Ownersおよびグローバル予定を取得
    this.scheduleData = await db.getScheduleList();

    this.renderCalendarGrid();
    this.renderSelectedDateSchedule();
  }

  // カレンダーグリッドの作成
  renderCalendarGrid() {
    this.daysGrid.innerHTML = "";

    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth(); // 0-indexed

    // 月間表示ラベル更新
    this.monthYearLabel.textContent = `${year}年${month + 1}月`;

    // 月の最初の日と最後の日
    const firstDayIndex = new Date(year, month, 1).getDay(); // 最初の日が何曜日か (0:日 ~ 6:土)
    const lastDate = new Date(year, month + 1, 0).getDate(); // この月の最後の日付 (28~31)
    
    // 前月の最後の日付
    const prevLastDate = new Date(year, month, 0).getDate();

    // カレンダー描画のためのグリッドセル生成
    // 日曜始まりのグリッドで、前月の空きスペースを埋める
    for (let i = firstDayIndex; i > 0; i--) {
      const dayNum = prevLastDate - i + 1;
      const cellDate = new Date(year, month - 1, dayNum);
      const cell = this.createDayCell(cellDate, true);
      this.daysGrid.appendChild(cell);
    }

    // 今月の日付を描画
    const today = new Date();
    for (let i = 1; i <= lastDate; i++) {
      const cellDate = new Date(year, month, i);
      const isToday = today.getDate() === i && today.getMonth() === month && today.getFullYear() === year;
      const cell = this.createDayCell(cellDate, false, isToday);
      this.daysGrid.appendChild(cell);
    }

    // 翌月の日付でグリッドの残りを埋める (合計42マスまたは35マス)
    const totalCellsSoFar = firstDayIndex + lastDate;
    const remainingCells = (totalCellsSoFar <= 35 ? 35 : 42) - totalCellsSoFar;
    for (let i = 1; i <= remainingCells; i++) {
      const cellDate = new Date(year, month + 1, i);
      const cell = this.createDayCell(cellDate, true);
      this.daysGrid.appendChild(cell);
    }
  }

  // 個々の日付セルを作成
  createDayCell(date, isOtherMonth, isToday = false) {
    const cell = document.createElement("div");
    cell.className = "calendar-day-cell animate-fade-in";
    if (isOtherMonth) cell.classList.add("other-month");
    if (isToday) cell.classList.add("today");

    // 日付数値を描画
    const numEl = document.createElement("span");
    numEl.className = "calendar-day-num";
    numEl.textContent = date.getDate();
    cell.appendChild(numEl);

    // この日付の予定を抽出してインジケーターを描画
    const dateStr = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
    const dayEvents = this.scheduleData.filter(item => {
      const startStr = item.startTime.split("T")[0];
      const endStr = item.endTime.split("T")[0];
      return dateStr >= startStr && dateStr <= endStr;
    });

    if (dayEvents.length > 0) {
      const dotsContainer = document.createElement("div");
      dotsContainer.className = "calendar-day-events";
      
      // 最大3つのドットを表示
      dayEvents.slice(0, 3).forEach(event => {
        const dot = document.createElement("span");
        dot.className = `event-dot ${event.isGlobal ? 'global' : 'personal'}`;
        dotsContainer.appendChild(dot);
      });
      cell.appendChild(dotsContainer);
    }

    // セルクリックで選択日を更新
    cell.onclick = () => {
      // 選択中セルの視覚スタイル変更
      document.querySelectorAll(".calendar-day-cell").forEach(c => c.style.backgroundColor = "");
      cell.style.backgroundColor = "var(--primary-light)";
      
      this.selectedDate = date;
      this.renderSelectedDateSchedule();
    };

    // 今日もしくは以前選択した日付と一致する場合はハイライトしておく
    if (this.selectedDate.toDateString() === date.toDateString()) {
      cell.style.backgroundColor = "var(--primary-light)";
    }

    return cell;
  }

  // 選択した日付の予定リストをサイドバーに描画
  renderSelectedDateSchedule() {
    const year = this.selectedDate.getFullYear();
    const month = this.selectedDate.getMonth() + 1;
    const day = this.selectedDate.getDate();
    const dayNames = ["日", "月", "火", "水", "木", "金", "土"];
    const dayName = dayNames[this.selectedDate.getDay()];

    this.selectedDateLabel.textContent = `${month}月${day}日 (${dayName}) の予定`;
    this.selectedDayScheduleList.innerHTML = "";

    const selectedDateStr = `${this.selectedDate.getFullYear()}-${String(this.selectedDate.getMonth()+1).padStart(2,'0')}-${String(this.selectedDate.getDate()).padStart(2,'0')}`;

    // 選択日にかかる予定を抽出
    const filteredSchedules = this.scheduleData.filter(item => {
      const startStr = item.startTime.split("T")[0];
      const endStr = item.endTime.split("T")[0];
      return selectedDateStr >= startStr && selectedDateStr <= endStr;
    }).sort((a, b) => a.startTime.localeCompare(b.startTime));

    if (filteredSchedules.length === 0) {
      this.selectedDayScheduleList.innerHTML = `
        <div style="text-align: center; color: var(--text-light); padding: 2rem 0; font-size: 0.85rem;">
          予定はありません
        </div>
      `;
      return;
    }

    filteredSchedules.forEach(item => {
      const div = document.createElement("div");
      div.className = `schedule-card-item ${item.isGlobal ? 'global' : 'personal'} animate-fade-in`;

      // 開始終了時刻の抽出
      const startTimeVal = item.startTime.split("T")[1] || "--:--";
      const endTimeVal = item.endTime.split("T")[1] || "--:--";

      div.innerHTML = `
        <div class="sch-item-time">
          <i class="fa-regular fa-clock"></i> ${startTimeVal} ~ ${endTimeVal}
          ${item.isGlobal ? '<span class="margin-l-md badge" style="background:#2563eb; color:#fff; font-size:0.65rem; padding:1px 5px; border-radius:4px;">全体</span>' : ''}
        </div>
        <div class="sch-item-title">${this.escapeHTML(item.title)}</div>
        ${item.description ? `<div class="sch-item-desc">${this.escapeHTML(item.description)}</div>` : ""}
      `;

      this.selectedDayScheduleList.appendChild(div);
    });
  }

  escapeHTML(str) {
    if (!str) return "";
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}

export const calendarComponent = new CalendarComponent();
