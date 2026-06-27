/**
 * app.js
 * アプリケーションのメインコントローラー
 * ログインセッション管理、疑似SPAのルーティング、および各タブコンポーネントのライフサイクル制御を行います。
 */
import { db } from "./db.js";
import { attendanceComponent } from "./components/attendance.js";
import { boardComponent } from "./components/board.js";
import { calendarComponent } from "./components/calendar.js";
import { mypageComponent } from "./components/mypage.js";
import { settingsComponent } from "./components/settings.js";
import { chatComponent } from "./components/chat.js";
import { contactComponent } from "./components/contact.js";

class AppController {
  constructor() {
    this.currentTab = null;
    this.components = {
      attendance: attendanceComponent,
      board: boardComponent,
      calendar: calendarComponent,
      mypage: mypageComponent,
      settings: settingsComponent,
      chat: chatComponent,
      contact: contactComponent
    };
  }

  // アプリケーション起動
  init() {
    this.setupGlobalElements();
    this.setupLoginHandler();
    this.setupNavigationHandler();
    this.setupMobileResponsive();
    this.checkSession();
  }

  setupGlobalElements() {
    this.loginScreen = document.getElementById("login-screen");
    this.appScreen = document.getElementById("app-screen");
    
    // サイドバープロフィール要素
    this.sidebarAvatar = document.getElementById("sidebar-avatar");
    this.sidebarName = document.getElementById("sidebar-name");
    this.sidebarDept = document.getElementById("sidebar-dept");
    
    // ヘッダー要素
    this.headerDate = document.getElementById("header-date");
    this.headerStatusBadge = document.getElementById("header-user-status");
    this.headerStatusText = document.getElementById("header-status-text");
    this.tabTitle = document.getElementById("current-tab-title");

    // ヘッダー日付の更新
    this.updateHeaderDate();
  }

  // セッションの確認と初期遷移（毎回ログインを必須とする仕様）
  checkSession() {
    // 自動ログインを廃止し、起動時やページ再読み込み時は必ずセッションをクリアしてログイン画面を表示します。
    db.logout();
    this.showLoginScreen();
  }

  // ========================================================
  // 1. ログイン/ログアウト制御
  // ========================================================
  setupLoginHandler() {
    const loginForm = document.getElementById("login-form");
    const emailInput = document.getElementById("login-email");
    const passwordInput = document.getElementById("login-password");
    const errorEl = document.getElementById("login-error");
    const btnLogout = document.getElementById("btn-logout");

    // ログイン実行
    loginForm.onsubmit = async (e) => {
      e.preventDefault();
      errorEl.textContent = "";

      const email = emailInput.value.trim();
      const password = passwordInput.value.trim();

      const result = await db.login(email, password);
      if (result.success) {
        // パスワード入力フィールドをクリア
        passwordInput.value = "";
        this.showAppDashboard(result.user);
      } else {
        errorEl.textContent = result.message;
      }
    };

    // ログアウト実行
    btnLogout.onclick = () => {
      if (confirm("ログアウトしますか？")) {
        // 動作中のコンポーネントをクリーンアップ
        this.unloadCurrentTab();
        db.logout();
        this.showLoginScreen();
      }
    };
  }

  showLoginScreen() {
    this.appScreen.classList.remove("active");
    this.appScreen.style.display = "none";
    
    this.loginScreen.style.display = "flex";
    // フェードイン時間を考慮してクラス付与
    setTimeout(() => {
      this.loginScreen.classList.add("active");
    }, 50);
  }

  showAppDashboard(user) {
    this.loginScreen.classList.remove("active");
    this.loginScreen.style.display = "none";
    
    this.appScreen.style.display = "flex";
    setTimeout(() => {
      this.appScreen.classList.add("active");
    }, 50);

    // サイドバーのプロフィール表示更新
    this.syncProfileUI(user);

    // デフォルトのタブ「勤怠管理」を表示
    this.switchTab("attendance");
  }

  // プロフィール編集時に他のUIと表示を合わせる同期メソッド
  syncProfileUI(user) {
    if (!user) return;
    
    // サイドバー
    this.sidebarAvatar.src = user.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&h=150&q=80";
    this.sidebarName.textContent = user.name;
    this.sidebarDept.textContent = `${user.department} / ${user.role}`;

    // ヘッダーの在席ステータス
    this.headerStatusText.textContent = user.status || "在席";
    
    // ステータスに応じたバッジカラー変更
    this.headerStatusBadge.className = "status-badge";
    if (user.status === "在席") {
      this.headerStatusBadge.classList.add("status-active");
    } else if (user.status === "外出中") {
      this.headerStatusBadge.classList.add("status-warning"); // CSSに警告色等が必要なら対応
      this.headerStatusBadge.style.backgroundColor = "var(--color-warning-bg)";
      this.headerStatusBadge.style.color = "var(--color-warning)";
    } else if (user.status === "会議中") {
      this.headerStatusBadge.style.backgroundColor = "var(--primary-light)";
      this.headerStatusBadge.style.color = "var(--primary)";
    } else {
      this.headerStatusBadge.style.backgroundColor = "var(--border-color)";
      this.headerStatusBadge.style.color = "var(--text-muted)";
    }
  }

  // ========================================================
  // 2. ナビゲーション & タブ制御
  // ========================================================
  setupNavigationHandler() {
    const navItems = document.querySelectorAll(".nav-item");

    navItems.forEach(item => {
      item.onclick = () => {
        const tabName = item.dataset.tab;
        
        // システム設定を開く場合のパスワード保護
        if (tabName === "settings") {
          const pw = prompt("システム設定のパスワードを入力してください:");
          const success = pw === "since1993";
          if (pw !== null) {
            this.logPasswordAttempt("settings", success);
          }
          if (!success) {
            if (pw !== null) {
              alert("パスワードが正しくありません。アクセスは拒否されました。");
            }
            return;
          }
        }
        
        // アクティブ表示の切り替え
        navItems.forEach(n => n.classList.remove("active"));
        item.classList.add("active");

        // タブ切り替え
        this.switchTab(tabName);
        
        // モバイル環境なら切り替え時にサイドバーを自動で閉じる
        const sidebar = document.querySelector(".sidebar");
        const overlay = document.querySelector(".sidebar-overlay");
        if (sidebar.classList.contains("active")) {
          sidebar.classList.remove("active");
          if (overlay) overlay.remove();
        }
      };
    });

    // 隠しチャットボタンのイベント（二重パスワード保護）
    const btnSecretChat = document.getElementById("btn-secret-chat");
    if (btnSecretChat) {
      btnSecretChat.onclick = () => {
        const pw = prompt("管理者用ページのパスワードを入力してください:");

        if (pw !== null) {
          this.logPasswordAttempt("secret-chat", pw === "secret123");
        }

        if (pw === "secret123") {
          // 通常ナビゲーションのアクティブを解除
          navItems.forEach(n => n.classList.remove("active"));
          
          // チャットタブへ切り替え
          this.switchTab("chat");

          // モバイル環境用
          const sidebar = document.querySelector(".sidebar");
          const overlay = document.querySelector(".sidebar-overlay");
          if (sidebar.classList.contains("active")) {
            sidebar.classList.remove("active");
            if (overlay) overlay.remove();
          }
        } else if (pw !== null) {
          alert("パスワードが正しくありません。アクセスは拒否されました。");
        }
      };
    }
  }

  // タブのアンロード
  unloadCurrentTab() {
    if (this.currentTab && this.components[this.currentTab]) {
      if (typeof this.components[this.currentTab].destroy === "function") {
        this.components[this.currentTab].destroy();
      }
    }
  }

  // タブ切り替え
  switchTab(tabName) {
    this.unloadCurrentTab();
    
    this.currentTab = tabName;

    // ヘッダーのタブタイトルを更新
    const tabTitles = {
      attendance: "勤怠管理 (Attendance)",
      board: "社内掲示板 (Notice Board)",
      calendar: "予定管理 (Calendar)",
      mypage: "マイページ (My Page)",
      settings: "システム設定 (Settings)",
      chat: "管理者用ページ (Admin Console)",
      contact: "管理者問い合わせ (Contact Admin)"
    };
    this.tabTitle.textContent = tabTitles[tabName] || "PortalHub";

    // セクションの切り替え
    const sections = document.querySelectorAll(".tab-content");
    sections.forEach(sec => {
      sec.classList.remove("active");
    });
    
    const activeSection = document.getElementById(`tab-${tabName}`);
    if (activeSection) {
      activeSection.classList.add("active");
    }

    // 各タブコンポーネントの初期化
    if (this.components[tabName]) {
      // マイページの場合はプロファイル更新時の同期コールバックを渡す
      if (tabName === "mypage") {
        this.components[tabName].init((updatedUser) => this.syncProfileUI(updatedUser));
      } else {
        this.components[tabName].init();
      }
    }
  }

  // ========================================================
  // 3. レスポンシブ＆ユーティリティ
  // ========================================================
  setupMobileResponsive() {
    const toggleBtn = document.getElementById("sidebar-toggle");
    const sidebar = document.querySelector(".sidebar");

    toggleBtn.onclick = () => {
      sidebar.classList.toggle("active");
      
      // 暗幕（オーバーレイ）のトグル
      if (sidebar.classList.contains("active")) {
        const overlay = document.createElement("div");
        overlay.className = "sidebar-overlay";
        document.body.appendChild(overlay);
        
        // 暗幕クリックでサイドバーを閉じる
        overlay.onclick = () => {
          sidebar.classList.remove("active");
          overlay.remove();
        };
      } else {
        const overlay = document.querySelector(".sidebar-overlay");
        if (overlay) overlay.remove();
      }
    };
  }

  logPasswordAttempt(target, success) {
    const currentUser = db.getCurrentUser();
    const config = db.getGASConfig();
    if (config.isEnabled && config.gasUrl) {
      fetch(config.gasUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          action: "logPasswordAttempt",
          email: currentUser ? currentUser.email : "unknown",
          target: target,
          success: success.toString(),
          timestamp: new Date().toISOString()
        })
      }).catch(err => console.error("ログ送信エラー:", err));
    }
  }

  updateHeaderDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const date = now.getDate();
    const dayNames = ["日", "月", "火", "水", "木", "金", "土"];
    const day = dayNames[now.getDay()];
    this.headerDate.textContent = `${year}年${month}月${date}日 (${day})`;
  }
}

// ページロード時にアプリケーションを初期化
window.onload = () => {
  const app = new AppController();
  app.init();
};
