import os
os.chdir('/f/swcup2026/AI 驱动的流浪动物防重复救助系统设计/raw/参考资料')
files = [f for f in os.listdir('.') if '软件杯' in f]
print('Files:', files)
for f in files:
    with open(f, 'r', encoding='utf-8') as fp:
        content = fp.read()
        print(content)