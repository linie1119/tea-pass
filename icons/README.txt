图标说明
========

Chrome 扩展需要 PNG 格式的图标文件：
- icon16.png (16x16)
- icon48.png (48x48)
- icon128.png (128x128)

已将 icon.svg 设计文件放在此目录下，你可以通过以下任一方式生成 PNG：

1. 在线转换（推荐）：
   访问 https://cloudconvert.com/svg-to-png 或 https://convertio.co/zh/svg-png/
   上传 icon.svg，分别导出 16x16、48x48、128x128 三种尺寸

2. 使用 Node.js 工具（如果你有 Node.js 环境）：
   npm install -g svgexport
   svgexport icon.svg icon16.png 16:16
   svgexport icon.svg icon48.png 48:48
   svgexport icon.svg icon128.png 128:128

3. 使用 Figma / Sketch / AI 等设计工具导出

如果不提供图标，扩展也能正常运行，Chrome 会显示默认图标。
