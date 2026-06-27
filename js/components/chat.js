/**
 * chat.js
 * シークレットチャットルームのUI描画と投稿・スクロール制御
 */
import { db } from "../db.js";

class ChatComponent {
  init() {
    this.setupElements();
    this.setupEventListeners();
    this.render();

    this._polling = false;
    this.pollInterval = setInterval(async () => {
      if (this._polling) return;
      this._polling = true;
      try {
        await this.render(true);
      } finally {
        this._polling = false;
      }
    }, 3000);

    // チャットを開いた時点で既読を送信
    db.updateChatReadStatus();
    this._readInterval = setInterval(() => {
      db.updateChatReadStatus();
    }, 10000);

    // 5分無操作で自動退出
    this._inactivityLimit = 5 * 60 * 1000;
    this._resetInactivityTimer();
    this._onActivity = () => this._resetInactivityTimer();
    document.addEventListener('mousemove', this._onActivity);
    document.addEventListener('keydown', this._onActivity);
    document.addEventListener('click', this._onActivity);
    document.addEventListener('touchstart', this._onActivity);
  }

  _resetInactivityTimer() {
    if (this._inactivityTimer) clearTimeout(this._inactivityTimer);
    this._inactivityTimer = setTimeout(() => {
      this._autoExitChat();
    }, this._inactivityLimit);
  }

  _autoExitChat() {
    alert('5分間操作がなかったため、管理者ページを自動的に閉じます。');
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(n => {
      n.classList.remove('active');
      if (n.dataset.tab === 'attendance') n.classList.add('active');
    });
    document.querySelectorAll('.tab-content').forEach(s => s.classList.remove('active'));
    document.getElementById('tab-attendance').classList.add('active');
    document.getElementById('current-tab-title').textContent = '勤怠管理 (Attendance)';
    this.destroy();
  }

  destroy() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
    if (this._readInterval) {
      clearInterval(this._readInterval);
    }
    if (this._inactivityTimer) {
      clearTimeout(this._inactivityTimer);
    }
    if (this._onActivity) {
      document.removeEventListener('mousemove', this._onActivity);
      document.removeEventListener('keydown', this._onActivity);
      document.removeEventListener('click', this._onActivity);
      document.removeEventListener('touchstart', this._onActivity);
      this._onActivity = null;
    }
  }

  setupElements() {
    this.container = document.getElementById("chat-messages-container");
    this.form = document.getElementById("chat-send-form");
    this.input = document.getElementById("chat-message-input");
  }

  setupEventListeners() {
    this.sending = false;

    this.form.onsubmit = async (e) => {
      e.preventDefault();
      if (this.sending) return;

      const messageText = this.input.value.trim();
      if (!messageText) return;

      this.sending = true;
      const submitBtn = this.form.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      this.input.value = "";

      try {
        await db.sendChatMessage(messageText);
      } catch (error) {
        alert("送信に失敗しました: " + error.message);
      } finally {
        this.sending = false;
        submitBtn.disabled = false;
      }

      await this.render(false);
    };
  }

  // 描画処理 (isPolling が true の場合は、ユーザーが過去ログを読んでいる最中に最下部へ勝手に戻るのを防ぎます)
  async render(isPolling = false) {
    const currentUser = db.getCurrentUser();
    if (!currentUser) return;

    // 現在スクロールが最下部付近にあるか判定 (誤差50px)
    const isAtBottom = this.container.scrollHeight - this.container.scrollTop <= this.container.clientHeight + 50;

    try {
      const messages = await db.getChatMessages();

      if (messages.length === 0) {
        const emptyHtml = `
          <div style="text-align: center; color: var(--text-light); padding: 3rem; margin: auto 0;">
            <i class="fa-solid fa-user-secret" style="font-size: 3rem; margin-bottom: 1rem; color: #cbd5e1;"></i>
            <p>シークレットチャットへようこそ。<br>ここでの会話はログアウトすると見えなくなります（モック動作時）。</p>
          </div>
        `;
        if (this.container.innerHTML !== emptyHtml) {
          this.container.innerHTML = emptyHtml;
        }
        return;
      }

      // 既読状態・リアクションを取得
      const readStatus = db.getChatReadStatus();
      const reactions = db.getChatReactions();
      const reactionEmojis = ['👍', '❤️', '😂', '😮', '😢'];

      // メッセージリストのHTMLを一時的に構築
      let newHtml = "";
      messages.forEach(msg => {
        const isMe = msg.email === currentUser.email;
        const rowClass = `chat-message-row ${isMe ? 'me' : 'other'}`;

        const date = new Date(msg.createdAt);
        const hours = String(date.getHours()).padStart(2, '0');
        const mins = String(date.getMinutes()).padStart(2, '0');
        const timeStr = `${hours}:${mins}`;

        // 自分のメッセージの既読判定
        let readLabel = "";
        if (isMe) {
          const otherEmails = Object.keys(readStatus).filter(e => e !== currentUser.email);
          const isRead = otherEmails.some(e => {
            const lastRead = new Date(readStatus[e]).getTime();
            return lastRead >= date.getTime();
          });
          readLabel = isRead ? '<span class="chat-msg-read">既読</span>' : '';
        }

        // リアクション表示
        const msgReactions = reactions[msg.id] || [];
        const reactionCounts = {};
        msgReactions.forEach(r => {
          if (!reactionCounts[r.reaction]) reactionCounts[r.reaction] = { count: 0, mine: false };
          reactionCounts[r.reaction].count++;
          if (r.email === currentUser.email) reactionCounts[r.reaction].mine = true;
        });

        let reactionHtml = '';
        if (Object.keys(reactionCounts).length > 0) {
          reactionHtml = '<div class="chat-reactions-display">';
          for (const [emoji, info] of Object.entries(reactionCounts)) {
            reactionHtml += `<span class="chat-reaction-badge ${info.mine ? 'mine' : ''}" data-msgid="${msg.id}" data-reaction="${emoji}">${emoji} ${info.count}</span>`;
          }
          reactionHtml += '</div>';
        }

        const reactionPicker = `<div class="chat-reaction-picker" data-msgid="${msg.id}">${reactionEmojis.map(e => `<span class="chat-reaction-btn" data-msgid="${msg.id}" data-reaction="${e}">${e}</span>`).join('')}</div>`;

        if (isMe) {
          newHtml += `
            <div class="${rowClass}">
              <div class="chat-msg-body">
                <div class="chat-msg-balloon" data-msgid="${msg.id}">${this.escapeHTML(msg.message)}${reactionPicker}</div>
                ${reactionHtml}
              </div>
              <div class="chat-msg-meta">
                ${readLabel}
                <span class="chat-msg-time">${timeStr}</span>
              </div>
            </div>
          `;
        } else {
          newHtml += `
            <div class="${rowClass}">
              <img src="${msg.senderAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=50&h=50&q=80'}" alt="Avatar" class="chat-msg-avatar">
              <div class="chat-msg-body">
                <span class="chat-msg-sender">${this.escapeHTML(msg.senderName)}</span>
                <div class="chat-msg-balloon" data-msgid="${msg.id}">${this.escapeHTML(msg.message)}${reactionPicker}</div>
                ${reactionHtml}
              </div>
              <span class="chat-msg-time">${timeStr}</span>
            </div>
          `;
        }
      });

      // メッセージIDの一覧で変化を検知（チラつき防止）
      // 既読状態はメッセージごとの既読/未読で判定（タイムスタンプ変化では更新しない）
      const readFlags = messages.map(msg => {
        if (msg.email !== currentUser.email) return '0';
        const otherEmails = Object.keys(readStatus).filter(e => e !== currentUser.email);
        const isRead = otherEmails.some(e => new Date(readStatus[e]).getTime() >= new Date(msg.createdAt).getTime());
        return isRead ? '1' : '0';
      }).join('');
      const reactKey = JSON.stringify(reactions);
      const newKey = messages.map(m => m.id).join(',') + '|' + readFlags + '|' + reactKey;
      if (this._lastKey !== newKey) {
        this._lastKey = newKey;
        this.container.innerHTML = newHtml;
        this.setupReactionListeners();
        
        // 送信後、またはすでに最下部にいた場合のみスクロール位置を最下部に調整
        if (!isPolling || isAtBottom) {
          this.scrollToBottom();
        }
      }

    } catch (error) {
      console.error("チャット読み込みエラー:", error);
      if (!isPolling) {
        this.container.innerHTML = `<div class="text-danger" style="padding: 1rem;">メッセージのロード中にエラーが発生しました。</div>`;
      }
    }
  }

  setupReactionListeners() {
    // 吹き出しクリックでリアクションピッカー表示
    this.container.querySelectorAll('.chat-msg-balloon').forEach(balloon => {
      balloon.addEventListener('click', (e) => {
        if (e.target.classList.contains('chat-reaction-btn')) return;
        const picker = balloon.querySelector('.chat-reaction-picker');
        if (picker) {
          const isVisible = picker.style.display === 'flex';
          this.container.querySelectorAll('.chat-reaction-picker').forEach(p => p.style.display = 'none');
          picker.style.display = isVisible ? 'none' : 'flex';
        }
      });
    });

    // リアクションボタンクリック
    this.container.querySelectorAll('.chat-reaction-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const msgId = btn.dataset.msgid;
        const reaction = btn.dataset.reaction;
        await db.toggleReaction(msgId, reaction);
        this.container.querySelectorAll('.chat-reaction-picker').forEach(p => p.style.display = 'none');
        await this.render(false);
      });
    });

    // 既存リアクションバッジクリックでトグル
    this.container.querySelectorAll('.chat-reaction-badge').forEach(badge => {
      badge.addEventListener('click', async (e) => {
        e.stopPropagation();
        const msgId = badge.dataset.msgid;
        const reaction = badge.dataset.reaction;
        await db.toggleReaction(msgId, reaction);
        await this.render(false);
      });
    });
  }

  scrollToBottom() {
    setTimeout(() => {
      this.container.scrollTop = this.container.scrollHeight;
    }, 50);
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

export const chatComponent = new ChatComponent();
