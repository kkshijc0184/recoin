// ---- Supabase config ----
const SUPA_URL = 'https://kkatnxsudgfukproekfs.supabase.co';
// Pega aqui tu clave publica (publishable/anon key) de Supabase:
const SUPA_KEY = 'sb_publishable_67pVfP4ZF7VzWMyoEmJsww_EgBML8nD';



function lcGet(key){ try{ return localStorage.getItem(key); }catch(e){ return null; } }
function lcSet(key, val){ try{ localStorage.setItem(key, val); }catch(e){} }
function lcDel(key){ try{ localStorage.removeItem(key); }catch(e){} }

