// 静默 uni 全局，避免测试环境报警告
;(globalThis as any).uni = {
  showToast: () => {},
  showModal: () => {},
  getImageInfo: () => {},
  createSelectorQuery: () => ({ select: () => ({ fields: () => ({ exec: () => {} }), boundingClientRect: () => ({ exec: () => {} }) }), exec: () => {} }),
}