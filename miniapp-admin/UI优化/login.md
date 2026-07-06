Admin Login 优化清单

# 改动 之前 现在

1 登录按钮 初始灰色（看着像坏） 初始主色绿，按下时微缩 0.98，loading 半透明
2 指纹图标 黑色（与绿底不协调） filter: invert(1) 变白
3 副标题 "管理后台" 4px 字距太散 "管理后台 · ADMIN" 2px 字距 + 英文点缀
4 输入框 无图标、placeholder 浅 加 📱/🔒 前缀图标，👀/🙈 密码可视切换
5 placeholder #BBBBBB（弱） #999999（更可读）
6 演示账号 无 加黄色提示卡片，一键自动填入 13900000001/admin123（评审演示利器）
7 底部 空 "© 鼻纹智救 · 第十五届中国软件杯"
8 品牌区 padding 160rpx（太空） 100rpx（更紧凑）
9 loading 状态 uni.showLoading 弹窗 按钮内置 "登录中..."，体验更流畅
10 disabled 防重 无 if (isLoading) return + :disabled 双重防重
关键技术点
用 :class="{ loading: isLoading }" + [disabled] 属性选择器，覆盖微信 button 自带 disabled 灰底
filter: brightness(0) invert(1) 是把黑色 PNG 变白色的标准技巧（无需重做图标资源）
演示账号卡片用了暖色背景（#FFFBF0）作为视觉提示色，与品牌绿色形成对比，不抢主色
