/**
 * board.js
 * 社内掲示板タブのUI描画と投稿フォーム制御
 */
import { db } from "../db.js";

class BoardComponent {
  init() {
    this.setupElements();
    this.setupEventListeners();
    this.render();
  }

  destroy() {
    // 破棄時のクリーンアップが必要な場合はここに実装
  }

  setupElements() {
    this.container = document.getElementById("board-posts-container");
    this.btnOpenForm = document.getElementById("btn-open-post-modal");
    this.formCard = document.getElementById("board-post-form-card");
    this.form = document.getElementById("board-post-form");
    this.btnCancel = document.getElementById("btn-cancel-post");
    
    this.titleInput = document.getElementById("post-title");
    this.categoryInput = document.getElementById("post-category");
    this.contentInput = document.getElementById("post-content");
  }

  setupEventListeners() {
    // フォーム開閉トグル
    this.btnOpenForm.onclick = () => {
      this.toggleForm(true);
    };

    this.btnCancel.onclick = () => {
      this.toggleForm(false);
      this.clearForm();
    };

    // 投稿送信
    this.form.onsubmit = async (e) => {
      e.preventDefault();
      
      const title = this.titleInput.value.trim();
      const content = this.contentInput.value.trim();
      const category = this.categoryInput.value;

      if (!title || !content) return;

      try {
        await db.addBoardPost(title, content, category);
        this.toggleForm(false);
        this.clearForm();
        this.render();
      } catch (error) {
        alert("投稿に失敗しました: " + error.message);
      }
    };
  }

  toggleForm(show) {
    if (show) {
      this.formCard.classList.remove("hidden-fold");
      this.formCard.classList.add("show-fold");
      this.btnOpenForm.style.display = "none";
    } else {
      this.formCard.classList.add("hidden-fold");
      this.formCard.classList.remove("show-fold");
      // アニメーション完了後にボタンを再表示
      setTimeout(() => {
        if (this.formCard.classList.contains("hidden-fold")) {
          this.btnOpenForm.style.display = "inline-flex";
        }
      }, 300);
    }
  }

  clearForm() {
    this.titleInput.value = "";
    this.contentInput.value = "";
    this.categoryInput.value = "一般";
  }

  // 描画処理
  async render() {
    this.container.innerHTML = "";
    
    try {
      const posts = await db.getBoardPosts();
      
      if (posts.length === 0) {
        this.container.innerHTML = `
          <div class="card" style="grid-column: 1 / -1; text-align: center; color: var(--text-light); padding: 3rem;">
            <i class="fa-regular fa-comment-dots" style="font-size: 3rem; margin-bottom: 1rem; color: #cbd5e1;"></i>
            <p>現在、掲示板への投稿はありません。</p>
          </div>
        `;
        return;
      }

      posts.forEach(post => {
        const card = document.createElement("div");
        card.className = "board-card animate-fade-in";

        // カテゴリタグのクラス割り当て
        let categoryClass = "general";
        if (post.category === "アナウンス") categoryClass = "announcement";
        else if (post.category === "メンテナンス") categoryClass = "maintenance";
        else if (post.category === "イベント") categoryClass = "event";

        // 作成日時のフォーマット
        const date = new Date(post.createdAt);
        const formattedDate = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

        // 投稿者の頭文字（アバターがない場合の代替）
        const authorInitial = post.authorName ? post.authorName.charAt(0) : "U";

        card.innerHTML = `
          <div class="board-card-header">
            <span class="board-category-tag ${categoryClass}">${post.category}</span>
            <span class="board-time">${formattedDate}</span>
          </div>
          <h4 class="board-card-title">${this.escapeHTML(post.title)}</h4>
          <div class="board-card-content">${this.escapeHTML(post.content)}</div>
          <div class="board-card-footer">
            <div class="board-author-avatar">
              <span>${authorInitial}</span>
            </div>
            <div class="board-author-name">${this.escapeHTML(post.authorName)}</div>
          </div>
        `;

        this.container.appendChild(card);
      });
    } catch (error) {
      console.error(error);
      this.container.innerHTML = `<div class="text-danger">データのロード中にエラーが発生しました。</div>`;
    }
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

export const boardComponent = new BoardComponent();
