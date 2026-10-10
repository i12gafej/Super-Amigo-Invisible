import { solveDraw } from './draw.ts';
import { simulateDraw } from './simulation.ts';
import { normalizeName, similarName, type Admin, type Portal, type Rule } from './types.ts';

type History = { rules: Rule; pairs: { giver: string; recipient: string }[] };
const initial: Admin = {
  room: { id: 'navidad-2026', name: 'Navidad en familia', budget: 30, date: '2026-12-25', closed: false },
  people: [
    { id: 'ana', name: 'Ana García', wishlist: 'Un libro que te haya gustado.\nCafé de especialidad. Mucho café.', canEdit: false, active: true },
    { id: 'pablo', name: 'Pablo Martín', wishlist: 'Calcetines de montaña, talla 42.\nUn juego de mesa para dos.', canEdit: false, active: true },
    { id: 'lucia', name: 'Lucía López', wishlist: 'Una planta que sobreviva a mí.\nUna libreta bonita.', canEdit: false, active: true },
    { id: 'dani', name: 'Dani Ruiz', wishlist: 'Auriculares o algo para cocinar.', canEdit: false, active: true },
  ],
  draws: [],
  rules: { op: 'AND', rules: [] },
};
let state = structuredClone(initial);
let current = 'ana';
let tokens: Record<string, string> = {};
let currentToken = '';
let assignments: Record<string, string> = {};
let history: Record<string, History> = {};
let loaded = false;

function reset() {
  state = structuredClone(initial);
  tokens = Object.fromEntries(state.people.map(p => [p.id, crypto.randomUUID()]));
  current = 'ana';
  currentToken = tokens[current];
  assignments = {};
  history = {};
}
function restore() {
  if (loaded) return;
  loaded = true;
  reset();
  try {
    const saved = localStorage.getItem('sai-demo-v2');
    if (!saved) return;
    const value = JSON.parse(saved);
    if (value.state?.room?.id !== initial.room.id || !Array.isArray(value.state.people) || !value.tokens) return;
    state = value.state;
    tokens = value.tokens;
    current = value.current;
    currentToken = value.currentToken;
    assignments = value.assignments || {};
    history = value.history || {};
  } catch { /* La demo funciona en memoria si no hay almacenamiento disponible. */ }
}
function save() {
  try { localStorage.setItem('sai-demo-v2', JSON.stringify({ state, tokens, current, currentToken, assignments, history })); }
  catch { /* El bloqueo de almacenamiento no debe impedir probar el flujo. */ }
}
function getPerson(id: string) {
  const person = state.people.find(p => p.id === id);
  if (!person) throw Error('Participante de demo inexistente.');
  return person;
}
function getCurrent() {
  const person = getPerson(current);
  if (!person.active || tokens[current] !== currentToken) throw Error('Enlace demo revocado o regenerado.');
  return person;
}
function linkFor(id: string) { return location.origin + '/demo#demo-' + tokens[id]; }

export async function demoRequest(path: string, data: Record<string, unknown> = {}): Promise<unknown> {
  restore();
  try {
    switch (path) {
      case 'exchange': {
        const token = String(data.token).replace(/^demo-/, '');
        const person = state.people.find(p => tokens[p.id] === token && p.active);
        if (!person) throw Error('Enlace demo inválido o revocado.');
        current = person.id;
        currentToken = token;
        return {};
      }
      case 'join': return structuredClone(state.room);
      case 'matches': return state.people.filter(p => similarName(p.name, String(data.name))).slice(0, 8).map(p => ({ name: p.name }));
      case 'register': {
        const name = String(data.name || '').trim();
        if (normalizeName(name).length < 2 || name.length > 80) throw Error('Escribe un nombre válido.');
        if (state.room.closed) throw Error('Registro cerrado.');
        if (state.people.length >= 80) throw Error('La sala admite hasta 80 participantes.');
        if (!data.confirmDuplicate && state.people.some(p => similarName(p.name, name))) throw Error('Confirma el aviso de nombre parecido.');
        current = crypto.randomUUID();
        tokens[current] = crypto.randomUUID();
        currentToken = tokens[current];
        state.people.push({ id: current, name, wishlist: '', canEdit: false, active: true });
        return { link: linkFor(current) };
      }
      case 'portal': {
        const person = getCurrent();
        const recipient = state.people.find(p => p.id === assignments[current]);
        return structuredClone({ room: state.room, person, recipient: recipient ? { name: recipient.name, wishlist: recipient.wishlist } : null } satisfies Portal);
      }
      case 'wishlist': {
        const p = getCurrent();
        if (state.room.closed && !p.canEdit) throw Error('La lista está cerrada.');
        const wishlist = String(data.wishlist || '');
        if (wishlist.length > 4000) throw Error('La lista es demasiado larga.');
        p.wishlist = wishlist;
        return {};
      }
      case 'admin/history': {
        const draw = history[String(data.id)];
        if (!draw) throw Error('Sorteo de demo inexistente.');
        return structuredClone(draw);
      }
      case 'admin/login':
      case 'admin': return structuredClone(state);
      case 'admin/wishlist': {
        const value = String(data.wishlist || '');
        if (value.length > 4000) throw Error('La lista es demasiado larga.');
        getPerson(String(data.id)).wishlist = value;
        return {};
      }
      case 'admin/permission': getPerson(String(data.id)).canEdit = data.enabled === true; return {};
      case 'admin/token': {
        const p = getPerson(String(data.id));
        if (data.action === 'copy') {
          if (!p.active) throw Error('Enlace revocado. Regenera uno nuevo.');
          return { link: linkFor(p.id) };
        }
        if (data.action === 'revoke') { p.active = false; return { link: null }; }
        if (data.action !== 'regenerate') throw Error('Acción inválida.');
        p.active = true;
        tokens[p.id] = crypto.randomUUID();
        return { link: linkFor(p.id) };
      }
      case 'admin/rules': {
        solveDraw(state.people.map(p => p.id), data.rules as Rule);
        state.rules = structuredClone(data.rules as Rule);
        return {};
      }
      case 'admin/validate': {
        solveDraw(state.people.map(p => p.id), (data.rules ?? state.rules) as Rule);
        return { message: 'Restricciones válidas. Existe un sorteo posible.' };
      }
      case 'admin/simulate': return simulateDraw(state.people, state.rules, Math.random);
      case 'admin/draw': {
        if (data.confirm !== true) throw Error('Confirma el nuevo sorteo.');
        assignments = solveDraw(state.people.map(p => p.id), state.rules);
        state.room.closed = true;
        const id = crypto.randomUUID();
        state.draws.unshift({ id, createdAt: new Date().toISOString(), count: state.people.length });
        history[id] = { rules: structuredClone(state.rules), pairs: Object.entries(assignments).map(([giver, recipient]) => ({ giver: getPerson(giver).name, recipient: getPerson(recipient).name })) };
        return {};
      }
      case 'logout': current = ''; currentToken = ''; return {};
      case 'reset': reset(); return {};
      default: throw Error('Acción de demo desconocida.');
    }
  } finally { save(); }
}
