from PIL import Image, ImageDraw

# Create 81x81 icons
size = 81

# Normal state - gray checkmark
img_normal = Image.new('RGBA', (size, size), (255, 255, 255, 0))
draw_normal = ImageDraw.Draw(img_normal)
draw_normal.rectangle([0, 0, size-1, size-1], fill=(245, 245, 245, 255))
# Simple checkmark
draw_normal.line([(20, 42), (35, 57), (60, 27)], fill=(153, 153, 153, 255), width=6)
img_normal.save('/mnt/f/swcup2026/miniapp-admin/src/static/tab-audit.png')

# Active state - red checkmark
img_active = Image.new('RGBA', (size, size), (255, 255, 255, 0))
draw_active = ImageDraw.Draw(img_active)
draw_active.rectangle([0, 0, size-1, size-1], fill=(255, 107, 107, 51))
draw_active.line([(20, 42), (35, 57), (60, 27)], fill=(255, 107, 107, 255), width=6)
img_active.save('/mnt/f/swcup2026/miniapp-admin/src/static/tab-audit-active.png')

print('Icons created successfully')
