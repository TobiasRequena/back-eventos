// Genera el esquema de una base en markdown.
// Uso: node scripts/generar_esquema.js <DATABASE_URL> <desarrollo|produccion>
//   → escribe ESQUEMA_DESARROLLO.md o ESQUEMA_PRODUCCION.md. Diffear los dos = lo que falta subir.
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const [url, entorno] = process.argv.slice(2);
if (!url || !['desarrollo', 'produccion'].includes(entorno)) {
  console.error('Uso: node scripts/generar_esquema.js <DATABASE_URL> <desarrollo|produccion>');
  process.exit(1);
}

const ACCIONES = { c: 'CASCADE', n: 'SET NULL', d: 'SET DEFAULT', r: 'RESTRICT' };

(async () => {
  const db = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await db.connect();
  const q = async (sql) => (await db.query(sql)).rows;

  const tablas = await q(`SELECT table_name t FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY 1`);
  const columnas = await q(`SELECT c.relname t, a.attname col, format_type(a.atttypid, a.atttypmod) tipo,
      CASE WHEN a.attnotnull THEN 'NO' ELSE 'YES' END nul, pg_get_expr(d.adbin, d.adrelid) def
    FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid
    LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
    WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r' AND a.attnum > 0 AND NOT a.attisdropped
    ORDER BY a.attnum`);
  const cons = await q(`SELECT conrelid::regclass::text t, conname, contype, pg_get_constraintdef(oid) def,
      confrelid::regclass::text ref, confdeltype,
      (SELECT string_agg(attname, ', ' ORDER BY array_position(conkey, attnum)) FROM pg_attribute
        WHERE attrelid = conrelid AND attnum = ANY(conkey)) cols,
      (SELECT string_agg(attname, ', ' ORDER BY array_position(confkey, attnum)) FROM pg_attribute
        WHERE attrelid = confrelid AND attnum = ANY(confkey)) refcols
    FROM pg_constraint WHERE connamespace = 'public'::regnamespace AND contype IN ('p','u','c','f')
    ORDER BY conname`);
  const indices = await q(`SELECT tablename t, indexname, indexdef FROM pg_indexes
    WHERE schemaname = 'public' ORDER BY indexname`);
  const enums = await q(`SELECT t.typname, string_agg(e.enumlabel, ',' ORDER BY e.enumsortorder) labels
    FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid GROUP BY 1 ORDER BY 1`);
  const funciones = await q(`SELECT p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' f
    FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace ORDER BY 1`);
  const migraciones = await q(`SELECT name FROM knex_migrations ORDER BY id`).catch(() => []);
  await db.end();

  // Sin fecha a propósito: así el diff entre los dos archivos muestra solo diferencias reales de esquema
  const out = [`# Esquema de ${entorno}`, '',
    `Generado con \`node scripts/generar_esquema.js <DATABASE_URL> ${entorno}\`. No editar a mano.`, ''];

  for (const { t } of tablas) {
    out.push(`## \`${t}\``, '', '| Columna | Tipo | Nullable | Default |', '|---|---|---|---|');
    for (const c of columnas.filter((c) => c.t === t)) out.push(`| ${c.col} | ${c.tipo} | ${c.nul} | ${c.def ?? ''} |`);
    out.push('');
    const deTabla = cons.filter((c) => c.t === t);
    const pk = deTabla.find((c) => c.contype === 'p');
    if (pk) out.push(`**PK**: ${pk.cols}`, '');
    const checks = deTabla.filter((c) => c.contype === 'c');
    if (checks.length) out.push(...checks.map((c) => `**Check**: \`${c.conname}\`: \`${c.def}\``), '');
    for (const u of deTabla.filter((c) => c.contype === 'u')) out.push(`**Unique**: (${u.cols})`, '');
    const fks = deTabla.filter((c) => c.contype === 'f');
    if (fks.length) {
      out.push('**FKs**:');
      for (const f of fks) {
        const accion = ACCIONES[f.confdeltype] ? ` (ON DELETE ${ACCIONES[f.confdeltype]})` : '';
        out.push(`- \`${f.cols}\` → \`${f.ref}.${f.refcols}\`${accion}`);
      }
      out.push('');
    }
    const idx = indices.filter((i) => i.t === t);
    if (idx.length) out.push('**Índices**:', ...idx.map((i) => `- \`${i.indexname}\`: \`${i.indexdef}\``), '');
  }

  out.push('## Enums', '', ...enums.map((e) => `- **${e.typname}**: ${e.labels.split(',').map((l) => `\`${l}\``).join(', ')}`), '');
  if (funciones.length) out.push('## Funciones', '', ...funciones.map((f) => `- \`${f.f}\``), '');
  if (migraciones.length) out.push('## Migraciones knex corridas', '', ...migraciones.map((m) => `- ${m.name}`), '');

  const archivo = path.join(__dirname, '..', `ESQUEMA_${entorno.toUpperCase()}.md`);
  fs.writeFileSync(archivo, out.join('\n'));
  console.log(`OK → ${path.basename(archivo)} (${tablas.length} tablas)`);
})().catch((e) => { console.error(e.message); process.exit(1); });
