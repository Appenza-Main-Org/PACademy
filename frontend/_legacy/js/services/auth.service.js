/**
 * Auth Service
 *
 * INTEGRATION CONTRACT (replace these methods to wire to real backend):
 *   POST /api/auth/login           → { token, user }
 *   GET  /api/auth/me              → user
 *   POST /api/auth/logout          → { ok }
 *   GET  /api/auth/permissions     → string[]
 *
 * Role permission matrix maps to RBAC on backend.
 */
(function() {
  'use strict';

  const ROLE_DEFINITIONS = {
    super_admin: {
      labelAr: 'مدير النظام الرئيسي',
      apps: ['admin','applicant','committee','board','investigations','medical','barcode','biometric','exams','architecture'],
      permissions: ['*'],
    },
    committee_admin: {
      labelAr: 'مدير لجنة قبول',
      apps: ['admin','committee','barcode','biometric'],
      permissions: ['applicants:view','applicants:edit','committees:manage','barcode:print','biometric:verify'],
    },
    committee_user: {
      labelAr: 'موظف لجنة قبول',
      apps: ['committee','barcode','biometric'],
      permissions: ['applicants:view','barcode:print','biometric:verify'],
    },
    medical_admin: {
      labelAr: 'مدير القومسيون الطبي',
      apps: ['medical','barcode','biometric'],
      permissions: ['medical:manage','results:enter','biometric:verify'],
    },
    medical_doctor: {
      labelAr: 'طبيب عيادة',
      apps: ['medical'],
      permissions: ['medical:examine','results:enter'],
    },
    investigator: {
      labelAr: 'محقق',
      apps: ['investigations'],
      permissions: ['investigations:view','investigations:edit'],
    },
    board_admin: {
      labelAr: 'أمين سر الهيئة',
      apps: ['board'],
      permissions: ['board:manage'],
    },
    exams_admin: {
      labelAr: 'مدير الاختبارات',
      apps: ['exams'],
      permissions: ['exams:manage','questions:manage','results:view'],
    },
    biometric_user: {
      labelAr: 'مستخدم بوابة الأمن',
      apps: ['biometric'],
      permissions: ['biometric:verify'],
    },
    records_clerk: {
      labelAr: 'مدخل نتائج',
      apps: ['medical','exams'],
      permissions: ['results:enter'],
    },
    applicant: {
      labelAr: 'متقدم',
      apps: ['applicant'],
      permissions: ['applicant:view','applicant:apply'],
    },
  };

  function fakeJWT(payload) {
    // Not a real JWT, just a base64-ish encoding for the demo
    return 'mock.' + btoa(unescape(encodeURIComponent(JSON.stringify(payload)))) + '.signature';
  }

  async function login(credentials) {
    // Simulate network latency
    await new Promise(r => setTimeout(r, 600));

    const { username, password, role } = credentials;
    if (!username || !password) {
      throw new Error('بيانات الدخول مطلوبة');
    }

    const roleDef = ROLE_DEFINITIONS[role] || ROLE_DEFINITIONS.super_admin;

    // Find a real user from mock data with matching role, or fall back to first super_admin
    const matchUser = (window.MockData?.users || []).find(u => u.role === role)
      || window.MockData.users[0];

    const user = {
      id: matchUser.id,
      name: matchUser.name,
      role,
      roleLabel: roleDef.labelAr,
      unit: matchUser.unit,
      apps: roleDef.apps,
      permissions: roleDef.permissions,
      token: fakeJWT({ sub: matchUser.id, role, iat: Date.now() }),
      loggedInAt: Date.now(),
    };

    Store.set({ auth: user });
    return user;
  }

  async function logout() {
    Store.clear();
  }

  function isAuthenticated() {
    return !!Store.get('auth');
  }

  function getCurrentUser() {
    return Store.get('auth');
  }

  function hasPermission(perm) {
    const auth = Store.get('auth');
    if (!auth) return false;
    if (auth.permissions.includes('*')) return true;
    return auth.permissions.includes(perm);
  }

  function canAccessApp(appKey) {
    const auth = Store.get('auth');
    if (!auth) return false;
    return auth.apps.includes(appKey);
  }

  window.AuthService = {
    login,
    logout,
    isAuthenticated,
    getCurrentUser,
    hasPermission,
    canAccessApp,
    roles: ROLE_DEFINITIONS,
  };
})();
