# Docker 開発環境

Phase 6: 元の予約 DB は `legacy/php/runtime/queue/` に移動済みです。Node はこの専用ディレクトリのみ読み取り専用でマウントし、PHP が書き込みと WAL/SHM の維持を担当します。旧 swipe 画面は短時間の読み取り専用チケットを使います。既存 DB の移動は停止・確認が必要で、代替 DB は作成しません。

Phase 4: 旧 PHP ソースとローカル実行データは `legacy/php/` に移動し、Apache の `/var/www/html` にマウントします。ブラウザー URL は変更しません。CLI 検査用にリポジトリを `/workspace` に読み取り専用でマウントします。旧 UI の Node 接続は `/api/v1/meta/health` のみで、業務処理は PHP のままです。[互換性](../docs/LEGACY_COMPATIBILITY.md)を参照してください。

## Phase 3 の起動先

リポジトリ直下で `docker compose -f docker/compose.yaml up --build -d` を実行すると、従来 PHP（http://127.0.0.1:8080）と統合 Node API（http://127.0.0.1:3000/health）が起動します。両ポートはローカルホストのみに公開されます。内部 Bridge の認証情報は初期化サービスが生成し、DB 更新は引き続き PHP だけが担当します。

`apps/user-web` と `apps/admin-web` でそれぞれ `npm ci` と `npm run dev` を実行してください（PowerShell では `npm.cmd`）。ポートは 5173 と 5174 で、PHP ではなく Node `/api/v1` に接続します。新管理 API は従来設定の空でない管理パスワードが必要です。[API Server](../apps/api-server/README.md) と [進捗](../docs/REFACTOR_PROGRESS.md) を参照してください。

この設定は、Windows 11 と Docker Desktop 上で「ゆかり」Web UI をローカル開発・確認するためのものです。PHP/Apache は Linux コンテナ内で動作します。Windows プレーヤーは含まれず、本番環境向けではありません。

## 必要な環境

- Windows 11 と、インストール済みで起動中の Docker Desktop。
- Docker Desktop は Linux コンテナーを使用してください（WSL 2 バックエンドを推奨）。
- リポジトリのルート `KaraokeRequestorWeb` で以下のコマンドを実行します。

## 起動

```powershell
docker compose -f docker/compose.yaml up --build
```

初回起動時に PHP 8.2 + Apache イメージをビルドし、必要な PHP 拡張をインストールします。Apache の起動後、<http://localhost:8080> を開いてください。バックグラウンドで起動する場合：

```powershell
docker compose -f docker/compose.yaml up --build -d
```

ログの確認：

```powershell
docker compose -f docker/compose.yaml logs -f web
```

停止してコンテナーを削除：

```powershell
docker compose -f docker/compose.yaml down
```

## 開発方法と制限

- Compose はリポジトリのルートを `/var/www/html` に読み書き可能な Bind Mount としてマウントします。PHP、CSS、JavaScript、画像を変更した後、ブラウザーを再読み込みすれば反映されます。イメージの再ビルドは不要です。
- 設定ファイル、SQLite データベース、アップロード画像などの実行時データはリポジトリ内に保存されます。コンテナーを停止・再作成しても削除されません。
- 起動スクリプトはローカル開発用にワークスペースの書き込み権限を設定します。信頼できるローカル環境でのみ使用し、本番環境や公開サービスには使用しないでください。
- SQLite/PDO SQLite、mbstring、cURL、GD、ZIP などの PHP 拡張が有効で、タイムゾーンは `Asia/Tokyo` です。
- MPC-BE、foobar2000 などの Windows プレーヤー、Windows 上の楽曲フォルダー、プレーヤー制御、およびローカルデバイスや権限に依存する機能は接続されていません。メディアライブラリがない場合、検索・リクエスト画面の UI 開発には使えますが、実際の曲は再生できません。
- Google Drive などの外部連携には個別の認証情報が必要です。外部 CDN やオンラインサービスにはネットワーク接続が必要です。

## トラブルシューティング

- 8080 番ポートが使用中の場合は、そのポートを使用しているプログラムを停止してください。
- `docker` コマンドが認識されない場合は、Docker Desktop をインストールして起動し、PowerShell を開き直してください。
- PHP エラーが表示された場合は `docker compose -f docker/compose.yaml logs web` でログを確認してください。イメージのビルド失敗、ワークスペースの書き込み権限、Windows プレーヤー依存機能へのアクセスなどが原因として考えられます。
- `docker compose ... down` ではワークスペースのデータは削除されません。ローカル状態をリセットする必要がない限り、設定ファイルや SQLite データベースを削除しないでください。
