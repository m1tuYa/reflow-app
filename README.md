# 往還

問いに答えるだけで回るタスク・アイデア管理ツール。個人用、ローカルWebアプリ、AIなし。
設計の詳細は作者手元の設計書を参照。

設計書の機能一覧(段階1〜4の29機能)はすべて実装済み。現状と、設計書から変えた点は [docs/実装まとめ.md](docs/実装まとめ.md) を参照。

## 開発

```bash
npm install
npm run dev
```

http://localhost:3000 を開く。データは `data/reflow.db` (SQLite, gitignore対象) にローカル保存される。
サンプルデータは `npm run seed` で入る(既存データは消える)。
