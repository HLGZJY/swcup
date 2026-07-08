// 静默 uni 全局，避免测试环境报警告
;(globalThis as any).uni = {
  showToast: () => {},
  showModal: () => {},
  showLoading: () => {},
  hideLoading: () => {},
  navigateTo: () => {},
  switchTab: () => {},
  redirectTo: () => {},
  navigateBack: () => {},
  setStorageSync: () => {},
  getStorageSync: () => null,
  removeStorageSync: () => {},
  getStorageInfoSync: () => ({ keys: [] }),
  reLaunch: () => {},
  chooseImage: () => {},
  getLocation: () => {},
  chooseLocation: () => {},
}
