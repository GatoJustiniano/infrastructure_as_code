// Carga datos de demostración (demo.json) cuando el módulo activo no tiene estudiantes.
// Las fechas se calculan desde "hoy", así la demo nunca queda desactualizada.
const crypto = require('crypto');
const demo = require('./demo.json');
const { pad, fechaISO } = require('../utils/excel');

const aFecha = (d) => `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;

// Mismo resultado en cada arranque para el mismo estudiante y fecha (0..1)
const azar = (clave) => crypto.createHash('md5').update(clave).digest().readUInt32BE(0) / 0xffffffff;

function fechasDeClase(hoy) {
  const c = demo.clases;
  const base = new Date(Date.UTC(+hoy.slice(6, 10), +hoy.slice(3, 5) - 1, +hoy.slice(0, 2)));
  const fechas = [];
  for (let i = -7 * c.semanas_atras; i <= 7 * c.semanas_adelante; i++) {
    const d = new Date(base.getTime() + i * 86400000);
    if (c.dias_semana.includes(d.getUTCDay()) || (c.incluir_hoy && i === 0)) fechas.push(aFecha(d));
  }
  return fechas;
}

async function cargarDemo({ run, get, moduloActivo, ahora }) {
  const m = await moduloActivo();
  if (!m || (await get(`SELECT 1 FROM estudiantes WHERE modulo_id = ?`, [m.id]))) return false;

  const hoy = ahora().fecha;
  const fechas = fechasDeClase(hoy);
  const { hora_inicio: ini, hora_fin: fin } = demo.clases;
  const { puntual, atraso } = demo.asistencia_pasada;

  await run('BEGIN');
  try {
    await run(`UPDATE modulos SET nombre = ? WHERE id = ?`, [demo.modulo, m.id]);
    for (const e of demo.estudiantes)
      await run(`INSERT INTO estudiantes (registro, nombre, correo, modulo_id) VALUES (?,?,?,?)`, [e.registro, e.nombre, e.correo, m.id]);
    for (const f of fechas)
      await run(`INSERT INTO fechas_clase (fecha, hora_inicio, hora_fin, modulo_id) VALUES (?,?,?,?)`, [f, ini, fin, m.id]);
    // Solo las clases pasadas tienen asistencia; sin registro cuentan como FALTA
    for (const f of fechas.filter((x) => fechaISO(x) < fechaISO(hoy)))
      for (const e of demo.estudiantes) {
        const r = azar(e.registro + f);
        if (r < puntual) await run(`INSERT INTO asistencias (registro, fecha, hora_marca, estado, modulo_id) VALUES (?,?,?,?,?)`, [e.registro, f, `18:${pad(45 + Math.floor(r * 15))}`, 'PUNTUAL', m.id]);
        else if (r < puntual + atraso) await run(`INSERT INTO asistencias (registro, fecha, hora_marca, estado, modulo_id) VALUES (?,?,?,?,?)`, [e.registro, f, `19:${pad(16 + Math.floor(r * 30))}`, 'ATRASO', m.id]);
      }
    await run('COMMIT');
  } catch (e) { await run('ROLLBACK'); throw e; }
  console.log(`Datos demo cargados: ${demo.estudiantes.length} estudiantes y ${fechas.length} fechas`);
  return true;
}

module.exports = { cargarDemo };
