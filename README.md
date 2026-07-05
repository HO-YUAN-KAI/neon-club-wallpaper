# Neon Club Wallpaper

一個可以當動態網頁桌布使用的 3D 電音派對視覺化器。載入本地音樂後，畫面會用 Web Audio API 分析低頻、中頻與高頻，再同步驅動 Three.js 製作的夜店雷射、燈光、粒子、隧道與均衡器動畫。

## 功能

- 本地音樂檔案輸入，不需要上傳音樂
- 可擷取 YouTube、瀏覽器分頁或系統音訊作為視覺化音源
- 雷射、聚光燈、粒子、3D 隧道、均衡器同步音訊
- 可調整能量與雷射強度
- 全螢幕模式，適合搭配 Wallpaper Engine 或瀏覽器桌布工具
- 控制列播放時會自動淡出，也可以按 `H` 顯示或隱藏

## 開發

```bash
npm install
npm run dev
```

打包：

```bash
npm run build
```

預覽打包結果：

```bash
npm run preview
```

## 作為桌布使用

1. 執行 `npm run dev` 或部署到 GitHub Pages。
2. 在瀏覽器打開頁面，載入你的本地音樂。
3. 按「全螢幕」進入沉浸模式。
4. 若使用 Wallpaper Engine，可以選擇網頁桌布並指向部署網址或本機伺服器網址。

## 使用 YouTube 當音源

1. 在瀏覽器另一個分頁打開 YouTube 並開始播放音樂。
2. 回到 Neon Club Wallpaper，按「擷取音源」。
3. 在瀏覽器分享視窗中選擇播放 YouTube 的分頁，並勾選「分享分頁音訊」或類似選項。
4. 畫面會改用 YouTube 分頁音訊同步雷射和燈光。

瀏覽器不能直接讀取 YouTube 影片檔或 iframe 音訊，所以這裡使用瀏覽器提供的螢幕/分頁音訊擷取 API。
