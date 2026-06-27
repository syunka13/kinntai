/**
 * mypage.js
 * マイページタブのUI描画、プロファイル編集、および個人勤怠統計の計算
 */
import { db } from "../db.js";

class MypageComponent {
  constructor() {
    this.onProfileUpdateCallback = null; // app.js側のUI同期用コールバック
  }

  init(onProfileUpdate) {
    if (onProfileUpdate) {
      this.onProfileUpdateCallback = onProfileUpdate;
    }
    this.setupElements();
    this.setupEventListeners();
    this.render();
  }

  destroy() {
    // クリーンアップ
  }

  setupElements() {
    this.form = document.getElementById("profile-form");
    this.avatarImg = document.getElementById("mypage-avatar-img");
    this.emailInput = document.getElementById("mypage-email");
    this.nameInput = document.getElementById("mypage-name");
    this.deptInput = document.getElementById("mypage-dept");
    this.roleInput = document.getElementById("mypage-role");
    this.statusInput = document.getElementById("mypage-status");
    this.successMsg = document.getElementById("profile-success-msg");
    
    // 統計要素
    this.statWorkDays = document.getElementById("stat-work-days");
    this.statTotalHours = document.getElementById("stat-total-hours");
  }

  setupEventListeners() {
    // プロフィール更新送信
    this.form.onsubmit = async (e) => {
      e.preventDefault();

      const name = this.nameInput.value.trim();
      const department = this.deptInput.value.trim();
      const role = this.roleInput.value.trim();
      const status = this.statusInput.value;

      try {
        const updatedUser = await db.updateUserProfile(name, department, role, status);
        
        // 成功メッセージ表示
        this.successMsg.classList.remove("hidden");
        setTimeout(() => {
          this.successMsg.classList.add("hidden");
        }, 3000);

        // メイン側（サイドバーやヘッダー）のUI表示を同期
        if (this.onProfileUpdateCallback) {
          this.onProfileUpdateCallback(updatedUser);
        }

        // マイページ内スタッツの再計算
        this.render();
      } catch (error) {
        alert("プロフィールの更新に失敗しました: " + error.message);
      }
    };
  }

  // 描画および統計計算
  async render() {
    const currentUser = db.getCurrentUser();
    if (!currentUser) return;

    // 基本情報のロード
    this.avatarImg.src = currentUser.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&h=150&q=80";
    this.emailInput.value = currentUser.email;
    this.nameInput.value = currentUser.name || "";
    this.deptInput.value = currentUser.department || "";
    this.roleInput.value = currentUser.role || "";
    this.statusInput.value = currentUser.status || "在席";

    // 勤怠統計の計算
    await this.calculateAttendanceStats();
  }

  // 今月の出勤日数と総労働時間を計算するプレミアムロジック
  async calculateAttendanceStats() {
    try {
      const history = await db.getAttendanceList(); // 自身(Row Owner)のデータのみ取得
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth(); // 0-indexed

      // 今月の履歴のみにフィルタリング
      const currentMonthHistory = history.filter(item => {
        const dateObj = new Date(item.date);
        return dateObj.getFullYear() === currentYear && dateObj.getMonth() === currentMonth;
      });

      // 出勤日数
      const workDays = currentMonthHistory.length;
      this.statWorkDays.textContent = workDays;

      // 総労働時間の計算
      let totalMinutes = 0;
      currentMonthHistory.forEach(item => {
        if (item.clockIn && item.clockOut) {
          const [inHour, inMin] = item.clockIn.split(":").map(Number);
          const [outHour, outMin] = item.clockOut.split(":").map(Number);
          
          // 分単位で計算
          const inTotalMin = inHour * 60 + inMin;
          const outTotalMin = outHour * 60 + outMin;
          
          if (outTotalMin > inTotalMin) {
            let diffMin = outTotalMin - inTotalMin;
            
            // 休憩時間エミュレーション（例: 労働時間が6時間を超える場合は45分、8時間以上の場合は60分を自動で差し引くなど。実運用的な配慮）
            const workHour = diffMin / 60;
            if (workHour >= 8) {
              diffMin -= 60; // 1時間休憩
            } else if (workHour >= 6) {
              diffMin -= 45; // 45分休憩
            }

            totalMinutes += diffMin;
          }
        }
      });

      const totalHours = totalMinutes / 60;
      // 小数点第1位まで表示
      this.statTotalHours.textContent = totalHours.toFixed(1);

    } catch (error) {
      console.error("勤怠統計計算エラー:", error);
      this.statWorkDays.textContent = "0";
      this.statTotalHours.textContent = "0.0";
    }
  }
}

export const mypageComponent = new MypageComponent();
