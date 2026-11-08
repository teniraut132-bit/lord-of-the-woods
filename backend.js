/* Lord of the Woods — shared Supabase data, player profiles and admin inbox.
   Only the public publishable key belongs in backend-config.js. */
(() => {
  'use strict';
  const cfg = window.LOTW_BACKEND_CONFIG || {};
  let visitorClient = null;
  let adminClient = null;
  let visitorUser = null;
  let adminUser = null;
  let adminRole = null;
  let status = 'not-configured';
  let lastError = '';
  let initPromise = null;

  const configured = () => !!(cfg.url && cfg.anonKey && window.supabase?.createClient);
  const message = e => String(e?.message || e || 'Неизвестная ошибка');
  const clone = value => JSON.parse(JSON.stringify(value));

  function setStatus(next, error = '') {
    status = next;
    lastError = error ? message(error) : '';
    const node = document.getElementById('saveStatus');
    if (node) {
      if (next === 'connected') node.textContent = 'Общий мир загружен из Supabase';
      else if (next === 'error') node.textContent = 'Облачная база недоступна: ' + lastError;
      else if (next === 'connecting') node.textContent = 'Подключение к общей базе…';
      else if (next === 'conflict') node.textContent = 'Есть параллельные изменения. Обновите страницу перед продолжением.';
      else if (next === 'saving') node.textContent = 'Сохраняем изменения в общей базе…';
    }
    window.dispatchEvent(new CustomEvent('lotw-backend-status', { detail: { status, error: lastError } }));
  }

  async function ensureVisitor() {
    if (!configured()) throw new Error('Не заполнены настройки Supabase.');
    if (!visitorClient) visitorClient = window.supabase.createClient(cfg.url, cfg.anonKey);
    const { data: sessionData, error: sessionError } = await visitorClient.auth.getSession();
    if (sessionError) throw sessionError;
    if (!sessionData.session) {
      const { error } = await visitorClient.auth.signInAnonymously();
      if (error) throw error;
    }
    const { data, error } = await visitorClient.auth.getUser();
    if (error) throw error;
    visitorUser = data.user;
    return visitorUser;
  }

  async function initialize() {
    if (!configured()) {
      setStatus('error', 'Supabase не настроен в backend-config.js.');
      return { configured: false, status };
    }
    if (!initPromise) {
      setStatus('connecting');
      initPromise = (async () => {
        try {
          await ensureVisitor();
          setStatus('connected');
          return { configured: true, status, visitorId: visitorUser?.id };
        } catch (e) {
          initPromise = null;
          setStatus('error', e);
          console.warn('[LOTW] Supabase initialization:', message(e));
          return { configured: true, status, error: message(e) };
        }
      })();
    }
    return initPromise;
  }

  async function loadSharedPart(part) {
    if (!['app', 'military'].includes(part)) throw new Error('Неизвестная часть общей базы.');
    await ensureVisitor();
    const { data, error } = await visitorClient
      .from('lotw_shared_data')
      .select('part,payload,revision,updated_at')
      .eq('part', part)
      .single();
    if (error) throw error;
    return { ok: true, part, payload: data.payload, revision: Number(data.revision), updatedAt: data.updated_at };
  }

  async function saveSharedPart(part, payload, expectedRevision) {
    if (!['app', 'military'].includes(part)) throw new Error('Неизвестная часть общей базы.');
    await ensureVisitor();
    const { data, error } = await visitorClient.rpc('lotw_save_shared_data', {
      p_part: part,
      p_payload: clone(payload),
      p_expected_revision: Number(expectedRevision)
    });
    if (error) throw error;
    const result = Array.isArray(data) ? data[0] : data;
    if (!result?.ok) return { ok: false, conflict: true, revision: Number(result?.revision ?? -1) };
    return { ok: true, revision: Number(result.revision) };
  }

  async function getProfile() {
    const user = await ensureVisitor();
    const { data, error } = await visitorClient.from('lotw_profiles')
      .select('player_name,active_state_id').eq('user_id', user.id).maybeSingle();
    if (error) throw error;
    return data || { player_name: '', active_state_id: null };
  }

  async function saveProfile(profile = {}) {
    const user = await ensureVisitor();
    const row = {
      user_id: user.id,
      player_name: String(profile.player_name || '').slice(0, 48),
      active_state_id: profile.active_state_id || null,
      updated_at: new Date().toISOString()
    };
    const { error } = await visitorClient.from('lotw_profiles').upsert(row, { onConflict: 'user_id' });
    if (error) throw error;
    return { ok: true };
  }

  async function trackEvent(evt) {
    try {
      const user = await ensureVisitor();
      const row = {
        actor_id: user.id,
        state_id: evt.stateId || null,
        state_name: evt.stateName || 'Без государства',
        player_name: String(evt.playerName || window.LOTW_PLAYER_NAME || 'Не указано').slice(0, 80),
        event_type: String(evt.eventType || 'event').slice(0, 60),
        title: String(evt.title || 'Действие').slice(0, 180),
        details: String(evt.details || '').slice(0, 6000),
        cleric_delta: Number(evt.clericDelta || 0),
        favor_delta: Number(evt.favorDelta || 0),
        status: 'new'
      };
      const { error } = await visitorClient.from('lotw_activity').insert(row);
      if (error) throw error;
      return { ok: true };
    } catch (e) {
      setStatus('error', e);
      console.warn('[LOTW] Activity sync failed:', message(e));
      return { ok: false, error: message(e) };
    }
  }

  async function myResponses() {
    try {
      const user = await ensureVisitor();
      const { data, error } = await visitorClient.from('lotw_activity')
        .select('id,state_name,title,details,admin_reply,status,created_at,replied_at')
        .eq('actor_id', user.id).not('admin_reply', 'is', null)
        .order('replied_at', { ascending: false }).limit(50);
      if (error) throw error;
      return { configured: true, rows: data || [] };
    } catch (e) {
      return { configured: true, rows: [], error: message(e) };
    }
  }

  async function loginAdmin(email, password) {
    if (!configured()) throw new Error('Сначала настройте Supabase в backend-config.js.');
    adminClient = window.supabase.createClient(cfg.url, cfg.anonKey, {
      auth: { persistSession: false, autoRefreshToken: true, detectSessionInUrl: false }
    });
    const { data, error } = await adminClient.auth.signInWithPassword({ email, password });
    if (error) throw error;
    adminUser = data.user;
    const { data: roleRow, error: roleError } = await adminClient.from('lotw_admins')
      .select('role').eq('user_id', adminUser.id).maybeSingle();
    if (roleError || !roleRow || !['admin', 'owner'].includes(roleRow.role)) {
      await adminClient.auth.signOut();
      adminUser = null;
      adminRole = null;
      throw new Error('У этой учётной записи нет роли admin или owner.');
    }
    adminRole = roleRow.role;
    return { user: adminUser.email, role: adminRole };
  }

  async function getAdminSession() {
    return adminUser ? { loggedIn: true, email: adminUser.email, role: adminRole } : { loggedIn: false };
  }

  async function adminLogout() {
    if (adminClient) await adminClient.auth.signOut();
    adminUser = null;
    adminRole = null;
    adminClient = null;
  }

  async function adminInbox() {
    if (!adminClient || !adminUser) throw new Error('Войдите в режим администратора.');
    const { data, error } = await adminClient.from('lotw_activity')
      .select('*').order('created_at', { ascending: false }).limit(500);
    if (error) throw error;
    return data || [];
  }

  async function replyToActivity(id, reply, newStatus = 'answered') {
    if (!adminClient || !adminUser) throw new Error('Войдите в режим администратора.');
    const { error } = await adminClient.from('lotw_activity').update({
      admin_reply: String(reply || '').trim().slice(0, 6000),
      status: ['answered', 'approved', 'rejected', 'needs-info'].includes(newStatus) ? newStatus : 'answered',
      replied_at: new Date().toISOString(),
      replied_by: adminUser.id
    }).eq('id', id);
    if (error) throw error;
    return { ok: true };
  }

  window.LOTWBackend = {
    isConfigured: configured, initialize, status: () => status, lastError: () => lastError,
    loadSharedPart, saveSharedPart, getProfile, saveProfile,
    trackEvent, myResponses, loginAdmin, getAdminSession, adminLogout,
    adminInbox, replyToActivity, visitorId: () => visitorUser?.id || null
  };
  initialize();
})();
