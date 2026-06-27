/**
 * db.js
 * データベース（ローカルストレージ & Googleスプレッドシート/GAS連携）管理モジュール
 * ログインユーザー情報に基づいた Row Owners（データアクセス制御）を実装します。
 */

// モック初期データ
const DEFAULT_MOCK_DATA = {
  users: [
    {
      email: "gyeeno3000@gmail.com",
      password: "Miku0410",
      name: "M",
      department: "総括本部",
      role: "共同管理者",
      status: "在席",
      avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=150&h=150&q=80"
    },
    {
      email: "syunka14@gmail.com",
      password: "since1993",
      name: "T",
      department: "総括本部",
      role: "代表管理者",
      status: "在席",
      avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=150&h=150&q=80"
    }
  ],
  attendance: [],
  board: [],
  schedule: [],
  chat: []
};

class SpreadsheetDatabase {
  constructor() {
    this.storageKey = "hp_portal_db_data";
    this.configKey = "hp_portal_gas_config";
    this.initDatabase();
  }

  // データベースの初期化（ローカルストレージにモックデータを格納）
  initDatabase(forceReset = false) {
    if (forceReset || !localStorage.getItem(this.storageKey)) {
      localStorage.setItem(this.storageKey, JSON.stringify(DEFAULT_MOCK_DATA));
    }
  }

  // GAS設定の取得
  getGASConfig() {
    const defaultConfig = {
      gasUrl: "https://script.google.com/macros/s/AKfycbyAgOvefT_uJUFUlJ52ESbtJav0O-W6YpOmohpxYFpOaS6wRR4nU6_z1dSfM4CMZlgj/exec",
      isEnabled: true
    };
    return defaultConfig;
  }

  // GAS設定の保存
  saveGASConfig(gasUrl, isEnabled) {
    localStorage.setItem(this.configKey, JSON.stringify({ gasUrl, isEnabled }));
  }

  // 内部的なローカルデータの全取得
  _getLocalData() {
    return JSON.parse(localStorage.getItem(this.storageKey)) || DEFAULT_MOCK_DATA;
  }

  // 内部的なローカルデータの保存
  _saveLocalData(data) {
    localStorage.setItem(this.storageKey, JSON.stringify(data));
  }

  // 現在のログインユーザーを取得
  getCurrentUser() {
    const userJson = sessionStorage.getItem("hp_portal_current_user");
    return userJson ? JSON.parse(userJson) : null;
  }

  // ログイン処理
  async login(email, password) {
    const config = this.getGASConfig();
    
    // GAS連携が有効な場合はGAS APIを叩く
    if (config.isEnabled && config.gasUrl) {
      try {
        const response = await fetch(`${config.gasUrl}?action=login&email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`);
        const result = await response.json();
        if (result.success) {
          if (result.sessionToken) {
            sessionStorage.setItem("hp_portal_session_token", result.sessionToken);
          }
          sessionStorage.setItem("hp_portal_current_user", JSON.stringify(result.user));
          return { success: true, user: result.user };
        }
        return { success: false, message: result.message || "ログインに失敗しました" };
      } catch (error) {
        console.error("GASログインエラー。モック認証にフォールバックします:", error);
      }
    }

    // ローカル（モック）認証
    const data = this._getLocalData();
    const user = data.users.find(u => u.email === email && u.password === password);
    if (user) {
      // セッションにはパスワードを含めずに格納
      const sessionUser = { ...user };
      delete sessionUser.password;
      sessionStorage.setItem("hp_portal_current_user", JSON.stringify(sessionUser));
      return { success: true, user: sessionUser };
    }
    return { success: false, message: "メールアドレスまたはパスワードが正しくありません" };
  }

  // ログアウト処理
  logout() {
    const currentUser = this.getCurrentUser();
    const token = sessionStorage.getItem("hp_portal_session_token");
    const config = this.getGASConfig();

    if (config.isEnabled && config.gasUrl && currentUser) {
      fetch(`${config.gasUrl}?action=logout&email=${encodeURIComponent(currentUser.email)}&token=${encodeURIComponent(token || '')}`)
        .catch(err => console.error("GASログアウトエラー:", err));
    }

    sessionStorage.removeItem("hp_portal_current_user");
    sessionStorage.removeItem("hp_portal_session_token");
  }

  // ----------------------------------------------------
  // 1. 勤怠管理 (Attendance) - Row Owners 制御付き
  // ----------------------------------------------------
  async getAttendanceList() {
    const currentUser = this.getCurrentUser();
    if (!currentUser) return [];

    const config = this.getGASConfig();
    if (config.isEnabled && config.gasUrl) {
      try {
        // GAS側でもRow Ownersを適用（emailをパラメータとして送信）
        const response = await fetch(`${config.gasUrl}?action=getAttendance&email=${encodeURIComponent(currentUser.email)}`);
        return await response.json();
      } catch (error) {
        console.error("GAS勤怠データ取得エラー。モックから読み込みます:", error);
      }
    }

    // ローカルモックでのRow Owners制御: ログイン中ユーザー of データのみをフィルタリング
    const data = this._getLocalData();
    return data.attendance
      .filter(item => item.email === currentUser.email)
      .sort((a, b) => b.date.localeCompare(a.date)); // 日付の新しい順
  }

  async clockIn(note = "") {
    const currentUser = this.getCurrentUser();
    if (!currentUser) throw new Error("ログインしていません");

    const today = new Date().toISOString().split("T")[0];
    const nowTime = new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });

    const config = this.getGASConfig();
    if (config.isEnabled && config.gasUrl) {
      try {
        const response = await fetch(config.gasUrl, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            action: "clockIn",
            email: currentUser.email,
            date: today,
            clockIn: nowTime,
            note: note
          })
        });
        const result = await response.json();
        if (result.success) return result.data;
      } catch (error) {
        console.error("GAS打刻エラー。モックで保存します:", error);
      }
    }

    const data = this._getLocalData();
    // 同一日付の打刻がすでにあるか確認
    const existing = data.attendance.find(item => item.email === currentUser.email && item.date === today);
    if (existing) {
      throw new Error("本日はすでに出勤打刻されています");
    }

    const newRecord = {
      id: "att_" + Date.now(),
      email: currentUser.email, // Row Owner情報として必須
      date: today,
      clockIn: nowTime,
      clockOut: "",
      status: "出勤",
      note: note
    };

    data.attendance.push(newRecord);
    this._saveLocalData(data);
    return newRecord;
  }

  async clockOut() {
    const currentUser = this.getCurrentUser();
    if (!currentUser) throw new Error("ログインしていません");

    const today = new Date().toISOString().split("T")[0];
    const nowTime = new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });

    const config = this.getGASConfig();
    if (config.isEnabled && config.gasUrl) {
      try {
        const response = await fetch(config.gasUrl, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            action: "clockOut",
            email: currentUser.email,
            date: today,
            clockOut: nowTime
          })
        });
        const result = await response.json();
        if (result.success) return result.data;
      } catch (error) {
        console.error("GAS退勤打刻エラー。モックで保存します:", error);
      }
    }

    const data = this._getLocalData();
    // 今日の出勤打刻レコードを探す
    const recordIndex = data.attendance.findIndex(item => item.email === currentUser.email && item.date === today);
    if (recordIndex === -1) {
      throw new Error("本日の出勤打刻が見つかりません。先に出勤打刻を行ってください。");
    }

    if (data.attendance[recordIndex].clockOut) {
      throw new Error("本日はすでに退勤打刻されています");
    }

    data.attendance[recordIndex].clockOut = nowTime;
    this._saveLocalData(data);
    return data.attendance[recordIndex];
  }

  // ----------------------------------------------------
  // 2. 掲示板 (Board) - 全員閲覧可能
  // ----------------------------------------------------
  async getBoardPosts() {
    const config = this.getGASConfig();
    if (config.isEnabled && config.gasUrl) {
      try {
        const response = await fetch(`${config.gasUrl}?action=getBoard`);
        return await response.json();
      } catch (error) {
        console.error("GAS掲示板データ取得エラー。モックから読み込みます:", error);
      }
    }

    const data = this._getLocalData();
    // 作成日時の新しい順にソート
    return [...data.board].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async addBoardPost(title, content, category = "一般") {
    const currentUser = this.getCurrentUser();
    if (!currentUser) throw new Error("ログインしていません");

    const newPost = {
      id: "board_" + Date.now(),
      title,
      content,
      authorName: currentUser.name,
      authorEmail: currentUser.email,
      createdAt: new Date().toISOString(),
      category
    };

    const config = this.getGASConfig();
    if (config.isEnabled && config.gasUrl) {
      try {
        const response = await fetch(config.gasUrl, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            action: "addBoard",
            ...newPost
          })
        });
        const result = await response.json();
        if (result.success) return result.data;
      } catch (error) {
        console.error("GAS掲示板投稿エラー。モックに保存します:", error);
      }
    }

    const data = this._getLocalData();
    data.board.push(newPost);
    this._saveLocalData(data);
    return newPost;
  }

  // ----------------------------------------------------
  // 3. 予定管理 (Calendar) - Row Owners 制御（個人） & 全体共有
  // ----------------------------------------------------
  async getScheduleList() {
    const currentUser = this.getCurrentUser();
    if (!currentUser) return [];

    const config = this.getGASConfig();
    if (config.isEnabled && config.gasUrl) {
      try {
        // GAS側でもRow Ownersに配慮して個人と共有データを取得
        const response = await fetch(`${config.gasUrl}?action=getSchedule&email=${encodeURIComponent(currentUser.email)}`);
        return await response.json();
      } catch (error) {
        console.error("GAS予定データ取得エラー。モックから読み込みます:", error);
      }
    }

    // ローカルモックでのRow Owners制御: 全体共有(`isGlobal: true`) もしくは ログイン中ユーザーの予定のみ取得
    const data = this._getLocalData();
    return data.schedule.filter(item => item.isGlobal || item.email === currentUser.email);
  }

  async addSchedule(title, description, startTime, endTime, isGlobal = false) {
    const currentUser = this.getCurrentUser();
    if (!currentUser) throw new Error("ログインしていません");

    const newSchedule = {
      id: "sch_" + Date.now(),
      email: currentUser.email, // 登録者のメールアドレス（Row Owner情報）
      title,
      description,
      startTime,
      endTime,
      isGlobal: isGlobal === true || isGlobal === "true"
    };

    const config = this.getGASConfig();
    if (config.isEnabled && config.gasUrl) {
      try {
        const response = await fetch(config.gasUrl, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            action: "addSchedule",
            ...newSchedule,
            isGlobal: newSchedule.isGlobal.toString()
          })
        });
        const result = await response.json();
        if (result.success) return result.data;
      } catch (error) {
        console.error("GAS予定追加エラー。モックに保存します:", error);
      }
    }

    const data = this._getLocalData();
    data.schedule.push(newSchedule);
    this._saveLocalData(data);
    return newSchedule;
  }

  // ----------------------------------------------------
  // 4. マイページ (My Page) & プロファイル編集
  // ----------------------------------------------------
  async updateUserProfile(name, department, role, status) {
    const currentUser = this.getCurrentUser();
    if (!currentUser) throw new Error("ログインしていません");

    const config = this.getGASConfig();
    if (config.isEnabled && config.gasUrl) {
      try {
        const response = await fetch(config.gasUrl, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            action: "updateProfile",
            email: currentUser.email,
            name,
            department,
            role,
            status
          })
        });
        const result = await response.json();
        if (result.success) {
          sessionStorage.setItem("hp_portal_current_user", JSON.stringify(result.user));
          return result.user;
        }
      } catch (error) {
        console.error("GASプロファイル更新エラー。モックで保存します:", error);
      }
    }

    const data = this._getLocalData();
    const userIndex = data.users.findIndex(u => u.email === currentUser.email);
    if (userIndex !== -1) {
      data.users[userIndex].name = name;
      data.users[userIndex].department = department;
      data.users[userIndex].role = role;
      data.users[userIndex].status = status;
      this._saveLocalData(data);

      const updatedUser = { ...data.users[userIndex] };
      delete updatedUser.password;
      sessionStorage.setItem("hp_portal_current_user", JSON.stringify(updatedUser));
      return updatedUser;
    }
    throw new Error("ユーザーが見つかりません");
  }

  // ----------------------------------------------------
  // 5. 裏チャット (Chat) - 全員閲覧可能
  // ----------------------------------------------------
  async getChatMessages() {
    const config = this.getGASConfig();

    // GAS連携が有効ならGASからメッセージと既読状態を取得
    if (config.isEnabled && config.gasUrl) {
      try {
        const response = await fetch(`${config.gasUrl}?action=getChat`);
        const result = await response.json();
        const remoteMessages = result.messages || (Array.isArray(result) ? result : []);
        if (result.readStatus) {
          this._chatReadStatus = result.readStatus;
        }
        if (result.reactions) {
          this._chatReactions = result.reactions;
        }

        // ローカルにのみある未送信メッセージ（GASにまだ届いていないもの）をマージ
        const data = this._getLocalData();
        const remoteIds = new Set(remoteMessages.map(m => m.id));
        const localOnly = (data.chat || []).filter(m => !remoteIds.has(m.id));
        const merged = [...remoteMessages, ...localOnly];

        // ローカルも更新
        data.chat = merged;
        this._saveLocalData(data);

        return merged.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
      } catch (error) {
        console.error("GASチャットデータ取得エラー。ローカルから読み込みます:", error);
      }
    }

    // フォールバック: ローカルデータ
    const data = this._getLocalData();
    const now = new Date().getTime();
    const tenMinutesMs = 24 * 60 * 60 * 1000;

    if (data.chat && data.chat.length > 0) {
      const initialCount = data.chat.length;
      data.chat = data.chat.filter(item => {
        const msgTime = new Date(item.createdAt).getTime();
        return (now - msgTime) < tenMinutesMs;
      });
      if (data.chat.length !== initialCount) {
        this._saveLocalData(data);
      }
    } else {
      data.chat = [];
    }

    return [...data.chat].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async sendChatMessage(message) {
    const currentUser = this.getCurrentUser();
    if (!currentUser) throw new Error("ログインしていません");

    const newMessage = {
      id: "chat_" + Date.now(),
      email: currentUser.email,
      senderName: currentUser.name,
      senderAvatar: currentUser.avatar,
      message: message,
      createdAt: new Date().toISOString()
    };

    // ローカルに即保存して画面に即反映
    const data = this._getLocalData();
    if (!data.chat) data.chat = [];
    data.chat.push(newMessage);
    this._saveLocalData(data);

    // GAS連携が有効ならバックグラウンドで送信（待たない）
    const config = this.getGASConfig();
    if (config.isEnabled && config.gasUrl) {
      fetch(config.gasUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          action: "sendChat",
          ...newMessage
        })
      }).catch(error => {
        console.error("GASチャット送信エラー:", error);
      });
    }

    return newMessage;
  }

  // チャット既読状態の取得
  getChatReadStatus() {
    return this._chatReadStatus || {};
  }

  // チャット既読状態の送信
  updateChatReadStatus() {
    const currentUser = this.getCurrentUser();
    if (!currentUser) return;
    const config = this.getGASConfig();
    if (config.isEnabled && config.gasUrl) {
      fetch(config.gasUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          action: "updateChatRead",
          email: currentUser.email,
          lastReadAt: new Date().toISOString()
        })
      }).catch(err => console.error("既読更新エラー:", err));
    }
  }

  // チャットリアクションの取得
  getChatReactions() {
    return this._chatReactions || {};
  }

  // チャットリアクションの送信
  async toggleReaction(messageId, reaction) {
    const currentUser = this.getCurrentUser();
    if (!currentUser) return;
    const config = this.getGASConfig();
    if (config.isEnabled && config.gasUrl) {
      try {
        const response = await fetch(config.gasUrl, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            action: "toggleReaction",
            messageId: messageId,
            email: currentUser.email,
            reaction: reaction
          })
        });
        return await response.json();
      } catch (err) {
        console.error("リアクションエラー:", err);
      }
    }
  }

  // モックデータのリセット
  resetMockData() {
    this.initDatabase(true);
  }

  // API疎通テスト
  async testGASConnection(url) {
    try {
      const response = await fetch(`${url}?action=ping`);
      const result = await response.json();
      return result.success && result.message === "pong";
    } catch (error) {
      console.error("GAS接続テスト失敗:", error);
      return false;
    }
  }

  // ----------------------------------------------------
  // 6. 管理者問い合わせメール送信 (Contact Mail)
  // ----------------------------------------------------
  async sendContactMail(subject, body) {
    const currentUser = this.getCurrentUser();
    const senderEmail = currentUser ? currentUser.email : "guest@example.com";
    const senderName = currentUser ? currentUser.name : "ゲストユーザー";

    const config = this.getGASConfig();
    if (config.isEnabled && config.gasUrl) {
      try {
        const response = await fetch(config.gasUrl, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            action: "sendMail",
            subject: subject,
            body: body,
            senderEmail: senderEmail,
            senderName: senderName
          })
        });
        const result = await response.json();
        if (result.success) return { success: true };
      } catch (error) {
        console.error("GASメール送信エラー。モック送信します:", error);
      }
    }

    // ローカルモック動作：ログに記録し、擬似的に成功を返す
    console.log(`[メール送信モック] 宛先: snc23@outlook.jp, 送信元: ${senderName} <${senderEmail}>, 件名: ${subject}, 本文: ${body}`);
    return { success: true, isMock: true };
  }
}

export const db = new SpreadsheetDatabase();
