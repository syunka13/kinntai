/**
 * contact.js
 * 管理者問い合わせタブのUI描画、入力バリデーション、およびメール送信指示
 */
import { db } from "../db.js";

class ContactComponent {
  init() {
    this.setupElements();
    this.setupEventListeners();
    this.resetView();
  }

  destroy() {
    // クリーンアップ
  }

  setupElements() {
    this.formArea = document.getElementById("contact-form-area");
    this.successArea = document.getElementById("contact-success-area");
    this.form = document.getElementById("contact-form");
    this.subjectInput = document.getElementById("contact-subject");
    this.bodyInput = document.getElementById("contact-body");
    this.btnSubmit = document.getElementById("btn-contact-submit");
    this.btnReset = document.getElementById("btn-contact-reset");
    this.errorEl = document.getElementById("contact-error");
  }

  setupEventListeners() {
    // フォーム送信
    this.form.onsubmit = async (e) => {
      e.preventDefault();
      this.errorEl.textContent = "";

      const subject = this.subjectInput.value.trim();
      const body = this.bodyInput.value.trim();

      if (!subject || !body) {
        this.errorEl.textContent = "件名と本文を入力してください。";
        return;
      }

      // 送信開始表示
      const originalBtnHtml = this.btnSubmit.innerHTML;
      this.btnSubmit.disabled = true;
      this.btnSubmit.innerHTML = '<span>送信中...</span> <i class="fa-solid fa-spinner fa-spin"></i>';

      try {
        const result = await db.sendContactMail(subject, body);
        
        if (result.success) {
          // モック送信時の警告をコンソールに表示
          if (result.isMock) {
            console.log("【デモ動作】GAS未連携のため実際には送信されません。送信先: snc23@outloook.jp");
          }
          
          // 送信成功画面へ切り替え
          this.formArea.classList.add("hidden");
          this.successArea.classList.remove("hidden");
        } else {
          this.errorEl.textContent = "送信に失敗しました。時間をおいて再度お試しください。";
        }
      } catch (error) {
        this.errorEl.textContent = "接続エラー: " + error.message;
      } finally {
        this.btnSubmit.disabled = false;
        this.btnSubmit.innerHTML = originalBtnHtml;
      }
    };

    // 完了画面から戻る
    this.btnReset.onclick = () => {
      this.resetView();
    };
  }

  resetView() {
    this.subjectInput.value = "";
    this.bodyInput.value = "";
    this.errorEl.textContent = "";
    this.successArea.classList.add("hidden");
    this.formArea.classList.remove("hidden");
  }
}

export const contactComponent = new ContactComponent();
