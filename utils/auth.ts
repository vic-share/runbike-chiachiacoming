
// src/utils/auth.ts

// 1. 定義身分標籤 (對應資料庫 roles 欄位)
export const ROLES = {
  DEV: 'DEV',
  COACH: 'COACH',
  AIDE: 'AIDE',
  RIDER: 'RIDER',
} as const;

// 2. 定義功能權限 (顆粒度細，程式邏輯用)
export const PERMISSIONS = {
  // --- 管理中心與系統 ---
  CONSOLE_ACCESS: 'console:access', // 能否看到「管理中心」按鈕 / 進入 Settings Admin View
  DEBUG_VIEW: 'system:debug',       // 能否看到 Debug 頁面

  // --- 課程管理 ---
  COURSE_VIEW_ALL: 'course:view_all', // 能看到所有人的報名狀況 (RIDER 只能看自己的)
  COURSE_EDIT: 'course:edit',         // 新增/修改/刪除課程、確認開課
  
  // --- 賽事管理 (New) ---
  RACE_MANAGE: 'race:manage',         // 新增/編輯賽事、管理選手、榮譽榜、批量報名

  // --- 現場執行 ---
  CHECK_IN: 'check_in:perform',       // 幫別人簽到/扣票 (尚未實作，預留)

  // --- 財務與票券 ---
  TICKET_MANAGE: 'ticket:manage',     // 設定批次、修改到期日、儲值
  TICKET_VIEW_ALL: 'ticket:view_all', // 查看所有人的餘額

  // --- 人員與設定 ---
  PEOPLE_MANAGE: 'people:manage',     // 新增/編輯選手
  PUSH_MANAGE: 'push:manage',         // 推播設定
  CONFIG_MANAGE: 'config:manage',     // 訓練項目與賽事系列設定
} as const;

// 3. 角色與權限的對照表 (核心邏輯)
export const ROLE_PERMISSIONS: Record<string, string[]> = {
  [ROLES.DEV]: [
    // DEV 擁有全部權限
    ...Object.values(PERMISSIONS)
  ],

  [ROLES.COACH]: [
    PERMISSIONS.CONSOLE_ACCESS,
    PERMISSIONS.COURSE_VIEW_ALL, PERMISSIONS.COURSE_EDIT,
    PERMISSIONS.RACE_MANAGE,   // Added
    PERMISSIONS.CHECK_IN,
    PERMISSIONS.TICKET_MANAGE, PERMISSIONS.TICKET_VIEW_ALL,
    PERMISSIONS.PEOPLE_MANAGE,
    PERMISSIONS.PUSH_MANAGE,
    PERMISSIONS.CONFIG_MANAGE
  ],

  [ROLES.AIDE]: [
    PERMISSIONS.CONSOLE_ACCESS,
    // PERMISSIONS.COURSE_VIEW_ALL, // Removed: Only Coach/Dev can manage courses
    PERMISSIONS.RACE_MANAGE,   // Added
    PERMISSIONS.CHECK_IN,      // 助手核心功能
    // AIDE 移除 TICKET 權限
    // 助手被排除：COURSE_EDIT, TICKET_MANAGE, TICKET_VIEW_ALL, PEOPLE_MANAGE
  ],

  [ROLES.RIDER]: [
    // RIDER 只有基本檢視權，通常不需要列在這裡，因為預設是公開或看自己的
  ]
};

// 解析使用者角色 (處理資料庫傳回來的 JSON 字串或已經是陣列的情況)
export const parseUserRoles = (user: any): string[] => {
  if (!user) return [];
  
  // 如果已經是陣列，直接回傳
  if (Array.isArray(user.roles)) return user.roles;

  // 如果是字串，嘗試解析
  if (typeof user.roles === 'string') {
    try {
      return JSON.parse(user.roles);
    } catch (e) {
      console.error("Role parsing error", e);
      return [];
    }
  }
  
  return []; // Default
};

// 核心檢查函式
export const hasPermission = (user: any, requiredPermission: string): boolean => {
  if (!user) return false;
  
  const userRoles = parseUserRoles(user);
  
  // 收集該使用者擁有的所有權限
  const userPermissions = new Set<string>();
  userRoles.forEach(role => {
    const perms = ROLE_PERMISSIONS[role] || [];
    perms.forEach(p => userPermissions.add(p));
  });

  return userPermissions.has(requiredPermission);
};

// 檢查是否擁有特定角色 (用於過濾列表)
export const hasRole = (user: any, role: string): boolean => {
    const roles = parseUserRoles(user);
    if (roles.includes(ROLES.DEV)) return true; // DEV has all roles
    return roles.includes(role);
};
