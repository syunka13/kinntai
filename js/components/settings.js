/**
 * settings.js
 * システム設定タブのUI描画、GAS（スプレッドシート）連携設定、およびモックDBリセット管理
 */
import { db } from "../db.js";

class SettingsComponent {
  init() {
    this.setupElements();
    this.setupEventListeners();
    this.render();
  }

  destroy() {
    // クリーンアップ
  }

  setupElements() {
    this.form = document.getElementById("settings-gas-form");
    this.isEnabledCheckbox = document.getElementById("settings-gas-enabled");
    this.gasUrlInput = document.getElementById("settings-gas-url");
    this.btnTestConnection = document.getElementById("btn-test-connection");
    this.testResultEl = document.getElementById("settings-test-result");
    
    this.btnResetMock = document.getElementById("btn-reset-mock");
    this.resetSuccessMsg = document.getElementById("reset-success-msg");
  }

  setupEventListeners() {
    // 設定保存
    this.form.onsubmit = (e) => {
      e.preventDefault();

      const gasUrl = this.gasUrlInput.value.trim();
      const isEnabled = this.isEnabledCheckbox.checked;

      db.saveGASConfig(gasUrl, isEnabled);
      alert("設定を保存しました。スプレッドシート同期が有効な場合、次回データロード時から反映されます。");
    };

    // 接続テスト
    this.btnTestConnection.onclick = async () => {
      const url = this.gasUrlInput.value.trim();
      if (!url) {
        this.showTestResult("URLが入力されていません", "text-danger");
        return;
      }

      this.showTestResult("接続テスト中...", "text-primary");
      this.btnTestConnection.disabled = true;

      try {
        const success = await db.testGASConnection(url);
        if (success) {
          this.showTestResult("✓ 接続成功 (スプレッドシート連携OK)", "text-success");
        } else {
          this.showTestResult("✗ 接続失敗 (URLまたはCORS設定を確認してください)", "text-danger");
        }
      } catch (error) {
        this.showTestResult("✗ 接続エラー: " + error.message, "text-danger");
      } finally {
        this.btnTestConnection.disabled = false;
      }
    };

    // モックデータベースのリセット
    this.btnResetMock.onclick = () => {
      if (confirm("ローカルのすべてのデータ（打刻履歴、投稿、予定）を初期デモデータにリセットしますか？\n（Googleスプレッドシート側の本物のデータは削除されません）")) {
        db.resetMockData();
        this.resetSuccessMsg.classList.remove("hidden");
        setTimeout(() => {
          this.resetSuccessMsg.classList.add("hidden");
        }, 3000);
      }
    };
  }

  showTestResult(message, className) {
    this.testResultEl.textContent = message;
    this.testResultEl.className = `margin-l-md weight-bold ${className}`;
  }

  render() {
    const config = db.getGASConfig();
    this.gasUrlInput.value = config.gasUrl || "";
    this.isEnabledCheckbox.checked = config.isEnabled || false;
    this.testResultEl.textContent = "";
  }
}

export const settingsComponent = new SettingsComponent();
