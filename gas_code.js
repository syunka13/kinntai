/**
 * gas_code.js
 * Google Apps Script (GAS) 用の完全版プログラムコード
 * 
 * 以下のコードをスプレッドシートの「拡張機能 ＞ Apps Script」に貼り付け、
 * Webアプリとしてデプロイ（公開）してください。
 */

// 連携対象のスプレッドシートID
const SPREADSHEET_ID = "1RUJEcAk2HDKWlVozbr09jF9o-6mfRfPecqu2j3BDWJo";
// お問い合わせメールの送信先アドレス（ここに直接メールが届きます）
const ADMIN_EMAIL = "snc23@outlook.jp";

// 初回承認用・テスト用関数
// GASエディタで「setup」を選択して「実行」を押すと、アクセス権の承認ダイアログが表示されます。
function setup() {
  // スプレッドシート作成とデータ読み込みをトリガー
  getSheet("Users");
  
  // テストメール送信をトリガー
  MailApp.sendEmail({
    to: ADMIN_EMAIL,
    subject: "【社内ポータル】初期セットアップテスト",
    body: "スプレッドシートとメール送信の権限承認が正常に完了しました。"
  });
  
  console.log("セットアップが成功しました！テストメールを送信しました。");
}

// シートオブジェクトの取得（存在しない場合は自動で初期ヘッダー付きでシートを作成します）
function getSheet(sheetName) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    // 各シートに必要なヘッダー行を自動作成
    if (sheetName === "Users") {
      sheet.appendRow(["email", "password", "name", "department", "role", "status", "avatar"]);
      // 初期の管理者アカウント（Tさん、Mさん）を自動で追加
      sheet.appendRow(["syunka14@gmail.com", "since1993", "T", "総括本部", "代表管理者", "在席", "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=150&h=150&q=80"]);
      sheet.appendRow(["gyeeno3000@gmail.com", "Miku0410", "M", "総括本部", "共同管理者", "在席", "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=150&h=150&q=80"]);
    } else if (sheetName === "Attendance") {
      sheet.appendRow(["id", "email", "date", "clockIn", "clockOut", "status", "note"]);
    } else if (sheetName === "Board") {
      sheet.appendRow(["id", "title", "content", "authorName", "authorEmail", "createdAt", "category"]);
    } else if (sheetName === "Schedule") {
      sheet.appendRow(["id", "email", "title", "description", "startTime", "endTime", "isGlobal"]);
    } else if (sheetName === "Chat") {
      sheet.appendRow(["id", "email", "senderName", "senderAvatar", "message", "createdAt", "日本時間"]);
    } else if (sheetName === "Sessions") {
      sheet.appendRow(["email", "token", "loginAt"]);
    } else if (sheetName === "PasswordLogs") {
      sheet.appendRow(["email", "target", "success", "timestamp"]);
    } else if (sheetName === "LoginLogs") {
      sheet.appendRow(["email", "success", "reason", "timestamp"]);
    } else if (sheetName === "ChatReadStatus") {
      sheet.appendRow(["email", "lastReadAt"]);
    } else if (sheetName === "ChatReactions") {
      sheet.appendRow(["messageId", "email", "reaction", "timestamp"]);
    }
  }
  return sheet;
}

// ヘルパー：指定したシートの全データを行オブジェクトの配列として取得
function getSheetData(sheetName) {
  const sheet = getSheet(sheetName);
  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return [];
  
  const headers = rows[0];
  const data = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = row[index];
    });
    data.push(obj);
  }
  return data;
}

// CORS対応用のJSONレスポンス生成
function createResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ========================================================
// 1. GET リクエスト（データの取得・認証）
// ========================================================
function doGet(e) {
  const action = e.parameter.action;
  const email = e.parameter.email;
  
  try {
    if (action === "ping") {
      return createResponse({ success: true, message: "pong" });
    }
    
    // ログイン認証
    if (action === "login") {
      const password = e.parameter.password;
      const users = getSheetData("Users");
      const user = users.find(u => u.email === email && u.password === password);

      const logSheet = getSheet("LoginLogs");
      const nowStr = new Date().toLocaleString("ja-JP", {timeZone: "Asia/Tokyo"});

      if (!user) {
        logSheet.appendRow([email, "false", "IDまたはパスワードが不一致", nowStr]);
        return createResponse({ success: false, message: "IDまたはパスワードが正しくありません" });
      }

      logSheet.appendRow([email, "true", "ログイン成功", nowStr]);

      // Mがログインした場合、Tにメール通知
      if (email !== "syunka14@gmail.com") {
        MailApp.sendEmail({
          to: "snc23@outlook.jp",
          subject: "【PortalHub】ログイン通知",
          body: user.name + "（" + email + "）がポータルにログインしました。\n\n日時: " + nowStr
        });
      }

      const userCopy = { ...user };
      delete userCopy.password;
      return createResponse({ success: true, user: userCopy });
    }

    // セッション解除（ログアウト）
    if (action === "logout") {
      const token = e.parameter.token;
      const sessSheet = getSheet("Sessions");
      const sessRows = sessSheet.getDataRange().getValues();
      for (let i = sessRows.length - 1; i >= 1; i--) {
        if (sessRows[i][0] === email || sessRows[i][1] === token) {
          sessSheet.deleteRow(i + 1);
        }
      }
      return createResponse({ success: true });
    }
    
    // 勤怠履歴の取得 (Row Owners: 自分のメールアドレスのデータのみ取得)
    if (action === "getAttendance") {
      const attendance = getSheetData("Attendance");
      const filtered = attendance.filter(item => item.email === email);
      return createResponse(filtered);
    }
    
    // 掲示板投稿の取得
    if (action === "getBoard") {
      const board = getSheetData("Board");
      return createResponse(board);
    }
    
    // 予定の取得 (Row Owners: 自分の予定、または全体共有の予定のみ取得)
    if (action === "getSchedule") {
      const schedule = getSheetData("Schedule");
      const filtered = schedule.filter(item => {
        const isGlobal = item.isGlobal === true || item.isGlobal === "true";
        return isGlobal || item.email === email;
      });
      return createResponse(filtered);
    }
    
    // チャットの取得 (送信から10分経過したものをスプレッドシートから物理削除して、有効なものだけ返す)
    if (action === "getChat") {
      const chatSheet = getSheet("Chat");
      const rows = chatSheet.getDataRange().getValues();
      const now = new Date().getTime();
      const tenMinutesMs = 24 * 60 * 60 * 1000;
      
      const validMessages = [];
      const headers = rows[0];
      
      if (rows.length > 1) {
        // 下からスキャンして古いメッセージを削除
        for (let i = rows.length - 1; i >= 1; i--) {
          const row = rows[i];
          const createdAt = new Date(row[headers.indexOf("createdAt")]).getTime();
          
          if (now - createdAt < tenMinutesMs) {
            const obj = {};
            headers.forEach((header, index) => {
              obj[header] = row[index];
            });
            validMessages.push(obj);
          } else {
            // 10分以上経過したメッセージ行をスプレッドシートから物理削除（クレンジング）
            chatSheet.deleteRow(i + 1);
          }
        }
      }
      // 既読状態を取得
      const readSheet = getSheet("ChatReadStatus");
      const readRows = readSheet.getDataRange().getValues();
      const readStatus = {};
      for (let i = 1; i < readRows.length; i++) {
        readStatus[readRows[i][0]] = readRows[i][1];
      }

      // リアクションを取得
      const reactSheet = getSheet("ChatReactions");
      const reactRows = reactSheet.getDataRange().getValues();
      const reactions = {};
      for (let i = 1; i < reactRows.length; i++) {
        const msgId = reactRows[i][0];
        if (!reactions[msgId]) reactions[msgId] = [];
        reactions[msgId].push({ email: reactRows[i][1], reaction: reactRows[i][2] });
      }

      return createResponse({ messages: validMessages.reverse(), readStatus: readStatus, reactions: reactions });
    }
    
    return createResponse({ success: false, message: "無効なGETアクションです" });
  } catch (error) {
    return createResponse({ success: false, message: error.toString() });
  }
}

// ========================================================
// 2. POST リクエスト（データの追加・編集・メール送信）
// ========================================================
function doPost(e) {
  const action = e.parameter.action;
  
  try {
    // 出勤打刻
    if (action === "clockIn") {
      const email = e.parameter.email;
      const date = e.parameter.date;
      const clockIn = e.parameter.clockIn;
      const note = e.parameter.note || "";
      
      const sheet = getSheet("Attendance");
      const attendance = getSheetData("Attendance");
      
      // 同一日の重複打刻チェック
      const existing = attendance.find(item => item.email === email && item.date === date);
      if (existing) {
        return createResponse({ success: false, message: "本日はすでに出勤打刻されています" });
      }
      
      const newRecord = ["att_" + Date.now(), email, date, clockIn, "", "出勤", note];
      sheet.appendRow(newRecord);
      
      return createResponse({ success: true, data: { id: newRecord[0], email, date, clockIn, clockOut: "", status: "出勤", note } });
    }
    
    // 退勤打刻
    if (action === "clockOut") {
      const email = e.parameter.email;
      const date = e.parameter.date;
      const clockOut = e.parameter.clockOut;
      
      const sheet = getSheet("Attendance");
      const rows = sheet.getDataRange().getValues();
      
      let foundRowIndex = -1;
      for (let i = 1; i < rows.length; i++) {
        if (rows[i][1] === email && rows[i][2] === date) {
          foundRowIndex = i + 1; // GASは1行目がヘッダー、2行目からデータなので+1
          break;
        }
      }
      
      if (foundRowIndex === -1) {
        return createResponse({ success: false, message: "本日の出勤打刻データが見つかりません" });
      }
      
      // 退勤列（E列/5列目）を更新
      sheet.getRange(foundRowIndex, 5).setValue(clockOut);
      return createResponse({ success: true });
    }
    
    // 掲示板への新規投稿
    if (action === "addBoard") {
      const sheet = getSheet("Board");
      const newPost = [
        e.parameter.id,
        e.parameter.title,
        e.parameter.content,
        e.parameter.authorName,
        e.parameter.authorEmail,
        e.parameter.createdAt,
        e.parameter.category
      ];
      sheet.appendRow(newPost);
      return createResponse({ success: true });
    }
    
    // カレンダー予定の追加
    if (action === "addSchedule") {
      const sheet = getSheet("Schedule");
      const newSchedule = [
        e.parameter.id,
        e.parameter.email,
        e.parameter.title,
        e.parameter.description,
        e.parameter.startTime,
        e.parameter.endTime,
        e.parameter.isGlobal
      ];
      sheet.appendRow(newSchedule);
      return createResponse({ success: true });
    }
    
    // マイプロフィールの更新
    if (action === "updateProfile") {
      const email = e.parameter.email;
      const name = e.parameter.name;
      const department = e.parameter.department;
      const role = e.parameter.role;
      const status = e.parameter.status;
      
      const sheet = getSheet("Users");
      const rows = sheet.getDataRange().getValues();
      
      let foundRowIndex = -1;
      for (let i = 1; i < rows.length; i++) {
        if (rows[i][0] === email) {
          foundRowIndex = i + 1;
          break;
        }
      }
      
      if (foundRowIndex === -1) {
        return createResponse({ success: false, message: "ユーザーが見つかりません" });
      }
      
      // name, department, role, status 列を更新
      sheet.getRange(foundRowIndex, 3).setValue(name);
      sheet.getRange(foundRowIndex, 4).setValue(department);
      sheet.getRange(foundRowIndex, 5).setValue(role);
      sheet.getRange(foundRowIndex, 6).setValue(status);
      
      const updatedUser = {
        email,
        name,
        department,
        role,
        status,
        avatar: rows[foundRowIndex - 1][6] // アバターは維持
      };
      
      return createResponse({ success: true, user: updatedUser });
    }
    
    // 管理者へのメール転送 (CORS対応 / アドレス隠蔽)
    if (action === "sendMail") {
      const subject = e.parameter.subject;
      const body = e.parameter.body;
      const senderEmail = e.parameter.senderEmail;
      const senderName = e.parameter.senderName;
      
      MailApp.sendEmail({
        to: ADMIN_EMAIL,
        subject: "【社内ポータル問合せ】" + subject,
        body: "送信元ユーザー: " + senderName + " (" + senderEmail + ")\n\n" + body
      });
      
      return createResponse({ success: true });
    }
    
    // チャットメッセージの追加
    // パスワード入力ログの記録
    if (action === "logPasswordAttempt") {
      const sheet = getSheet("PasswordLogs");
      sheet.appendRow([
        e.parameter.email,
        e.parameter.target,
        e.parameter.success,
        e.parameter.timestamp
      ]);
      return createResponse({ success: true });
    }

    // チャット既読状態の更新
    if (action === "updateChatRead") {
      const sheet = getSheet("ChatReadStatus");
      const rows = sheet.getDataRange().getValues();
      let found = false;
      for (let i = 1; i < rows.length; i++) {
        if (rows[i][0] === e.parameter.email) {
          sheet.getRange(i + 1, 2).setValue(e.parameter.lastReadAt);
          found = true;
          break;
        }
      }
      if (!found) {
        sheet.appendRow([e.parameter.email, e.parameter.lastReadAt]);
      }
      return createResponse({ success: true });
    }

    // リアクションの追加/削除
    if (action === "toggleReaction") {
      const sheet = getSheet("ChatReactions");
      const rows = sheet.getDataRange().getValues();
      var found = false;
      for (var i = rows.length - 1; i >= 1; i--) {
        if (rows[i][0] === e.parameter.messageId && rows[i][1] === e.parameter.email && rows[i][2] === e.parameter.reaction) {
          sheet.deleteRow(i + 1);
          found = true;
          break;
        }
      }
      if (!found) {
        sheet.appendRow([e.parameter.messageId, e.parameter.email, e.parameter.reaction, new Date().toISOString()]);
      }
      return createResponse({ success: true, added: !found });
    }

    if (action === "sendChat") {
      const sheet = getSheet("Chat");
      const jstTime = new Date(e.parameter.createdAt).toLocaleString("ja-JP", {timeZone: "Asia/Tokyo"});
      const newMsg = [
        e.parameter.id,
        e.parameter.email,
        e.parameter.senderName,
        e.parameter.senderAvatar,
        e.parameter.message,
        e.parameter.createdAt,
        jstTime
      ];
      sheet.appendRow(newMsg);
      return createResponse({ success: true });
    }
    
    return createResponse({ success: false, message: "無効なPOSTアクションです" });
  } catch (error) {
    return createResponse({ success: false, message: error.toString() });
  }
}
