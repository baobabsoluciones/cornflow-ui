/**
 * Demo data served by the mock backend of the documentation screenshots.
 *
 * A neutral production-planning app: plants, products, lines and weekly demand in, a production
 * plan out. Nothing here comes from a real deployment, so the screenshots can be published.
 *
 * Plain JavaScript (not TypeScript) so that packages built on the core (enterprise) can import it
 * from node_modules in their own Playwright runs.
 */

/** The moment every screenshot is taken at (Europe/Madrid), so dates read the same on every run. */
export const DEMO_NOW = '2026-10-21T11:30:00+02:00'

export const DEMO_DAG = 'demo_planning'
export const DEMO_SECOND_DAG = 'demo_stock'
export const DEMO_APP_NAME = 'Planificador demo'

/** External configuration (`values.json`) of the demo deployment. */
export const demoValues = {
  backend_url: 'https://demo-backend.example',
  schema: DEMO_DAG,
  name: DEMO_APP_NAME,
  hasExternalApp: true,
  isStagingEnvironment: false,
  useHashMode: true,
  defaultLanguage: 'es',
  isDeveloperMode: false,
  auth_type: 'cornflow',
}

// ─── Users and roles ──────────────────────────────────────────────────────────

export const demoUser = {
  id: 1,
  username: 'demo',
  email: 'demo@example.com',
  first_name: 'Usuario',
  last_name: 'Demo',
}

export const demoUsers = [
  demoUser,
  { id: 2, username: 'lgomez', email: 'lgomez@example.com', first_name: 'Lucía', last_name: 'Gómez' },
  { id: 3, username: 'jruiz', email: 'jruiz@example.com', first_name: 'Javier', last_name: 'Ruiz' },
  { id: 4, username: 'mserrano', email: 'mserrano@example.com', first_name: 'Marta', last_name: 'Serrano' },
  { id: 5, username: 'consulta', email: 'consulta@example.com', first_name: 'Equipo', last_name: 'Consulta' },
]

export const demoRoles = [
  { id: 1, name: 'admin' },
  { id: 2, name: 'planner' },
  { id: 3, name: 'viewer' },
]

export const demoRoleAssignments = [
  { id: 1, user_id: 1, role_id: 1, user: 'demo', role: 'admin' },
  { id: 2, user_id: 1, role_id: 2, user: 'demo', role: 'planner' },
  { id: 3, user_id: 2, role_id: 2, user: 'lgomez', role: 'planner' },
  { id: 4, user_id: 3, role_id: 2, user: 'jruiz', role: 'planner' },
  { id: 5, user_id: 4, role_id: 3, user: 'mserrano', role: 'viewer' },
  { id: 6, user_id: 5, role_id: 3, user: 'consulta', role: 'viewer' },
]

// ─── Schema of the DAG ────────────────────────────────────────────────────────

const plantas = {
  type: 'array',
  title: 'Plantas',
  description: 'Plantas de producción y sus horas disponibles por semana.',
  items: {
    type: 'object',
    properties: {
      id_planta: { type: 'string', title: 'Planta' },
      nombre: { type: 'string', title: 'Nombre' },
      region: { type: 'string', title: 'Región' },
      horas_semana: { type: 'number', title: 'Horas por semana' },
    },
    required: ['id_planta', 'nombre', 'horas_semana'],
  },
}

const productos = {
  type: 'array',
  title: 'Productos',
  items: {
    type: 'object',
    properties: {
      codigo: { type: 'string', title: 'Código' },
      nombre: { type: 'string', title: 'Nombre' },
      familia: { type: 'string', title: 'Familia' },
      coste_unitario: { type: ['number', 'null'], title: 'Coste unitario (€)' },
    },
    required: ['codigo', 'nombre'],
  },
}

const lineas = {
  type: 'array',
  title: 'Líneas',
  items: {
    type: 'object',
    properties: {
      id_linea: { type: 'string', title: 'Línea' },
      id_planta: { type: 'string', title: 'Planta' },
      codigo: { type: 'string', title: 'Producto' },
      unidades_hora: { type: 'number', title: 'Unidades por hora' },
    },
    required: ['id_linea', 'id_planta', 'codigo', 'unidades_hora'],
  },
}

const demanda = {
  type: 'array',
  title: 'Demanda',
  items: {
    type: 'object',
    properties: {
      semana: { type: 'integer', title: 'Semana' },
      id_planta: { type: 'string', title: 'Planta' },
      codigo: { type: 'string', title: 'Producto' },
      unidades: { type: 'number', title: 'Unidades' },
    },
    required: ['semana', 'id_planta', 'codigo', 'unidades'],
  },
}

const parametros = {
  type: 'object',
  title: 'Parámetros',
  properties: {
    horizonte_semanas: { type: 'integer', title: 'Horizonte (semanas)' },
    nivel_servicio: { type: 'number', title: 'Nivel de servicio objetivo' },
    permitir_horas_extra: { type: 'boolean', title: 'Permitir horas extra' },
  },
}

export const instanceSchema = {
  type: 'object',
  properties: { plantas, productos, lineas, demanda, parametros },
  required: ['plantas', 'productos', 'lineas', 'demanda'],
}

export const instanceChecksSchema = {
  type: 'object',
  properties: {
    demanda_sin_linea: {
      type: 'array',
      title: 'Demanda sin línea',
      description: 'Productos con demanda en una planta que no tiene línea para fabricarlos.',
      is_warning: false,
      items: {
        type: 'object',
        properties: {
          semana: { type: 'integer', title: 'Semana' },
          id_planta: { type: 'string', title: 'Planta' },
          codigo: { type: 'string', title: 'Producto' },
          unidades: { type: 'number', title: 'Unidades' },
        },
      },
    },
    productos_sin_coste: {
      type: 'array',
      title: 'Productos sin coste',
      description: 'Productos sin coste unitario: el plan los fabrica sin coste.',
      is_warning: true,
      items: {
        type: 'object',
        properties: {
          codigo: { type: 'string', title: 'Producto' },
          nombre: { type: 'string', title: 'Nombre' },
        },
      },
    },
  },
}

export const solutionSchema = {
  type: 'object',
  properties: {
    plan_produccion: {
      type: 'array',
      title: 'Plan de producción',
      items: {
        type: 'object',
        properties: {
          semana: { type: 'integer', title: 'Semana' },
          id_planta: { type: 'string', title: 'Planta' },
          id_linea: { type: 'string', title: 'Línea' },
          codigo: { type: 'string', title: 'Producto' },
          unidades: { type: 'number', title: 'Unidades' },
          horas: { type: 'number', title: 'Horas' },
        },
      },
    },
    uso_capacidad: {
      type: 'array',
      title: 'Uso de capacidad',
      items: {
        type: 'object',
        properties: {
          semana: { type: 'integer', title: 'Semana' },
          id_planta: { type: 'string', title: 'Planta' },
          horas_disponibles: { type: 'number', title: 'Horas disponibles' },
          horas_usadas: { type: 'number', title: 'Horas usadas' },
          utilizacion: { type: 'number', title: 'Utilización (%)' },
        },
      },
    },
  },
}

export const solutionChecksSchema = {
  type: 'object',
  properties: {
    demanda_no_servida: {
      type: 'array',
      title: 'Demanda no servida',
      is_warning: true,
      items: {
        type: 'object',
        properties: {
          semana: { type: 'integer', title: 'Semana' },
          id_planta: { type: 'string', title: 'Planta' },
          codigo: { type: 'string', title: 'Producto' },
          unidades: { type: 'number', title: 'Unidades' },
        },
      },
    },
  },
}

export const configSchema = {
  type: 'object',
  properties: {
    nivel_servicio: {
      type: 'number',
      title: { es: 'Nivel de servicio objetivo (%)', en: 'Target service level (%)' },
    },
    permitir_horas_extra: {
      type: 'boolean',
      title: { es: 'Permitir horas extra', en: 'Allow overtime' },
      default: false,
    },
    timeLimit: {
      type: 'integer',
      title: { es: 'Tiempo límite (s)', en: 'Time limit (s)' },
      default: 300,
    },
    rel_gap: {
      type: 'number',
      title: { es: 'Gap relativo', en: 'Relative gap' },
      default: 0.01,
    },
    solver: { type: 'string', enum: ['mip.cbc', 'mip.gurobi'], default: 'mip.cbc' },
  },
  required: ['nivel_servicio'],
}

export const demoSchema = {
  name: DEMO_DAG,
  config: configSchema,
  instance: instanceSchema,
  instance_checks: instanceChecksSchema,
  solution: solutionSchema,
  solution_checks: solutionChecksSchema,
}

// ─── Data of an execution ─────────────────────────────────────────────────────

const PLANTS = [
  { id_planta: 'P01', nombre: 'Planta Norte', region: 'Norte', horas_semana: 220 },
  { id_planta: 'P02', nombre: 'Planta Centro', region: 'Centro', horas_semana: 168 },
  { id_planta: 'P03', nombre: 'Planta Sur', region: 'Sur', horas_semana: 160 },
]

const PRODUCTS = [
  { codigo: 'A-100', nombre: 'Envase 0,5 L', familia: 'Envases', coste_unitario: 0.42 },
  { codigo: 'A-150', nombre: 'Envase 1 L', familia: 'Envases', coste_unitario: 0.61 },
  { codigo: 'B-200', nombre: 'Tapón estándar', familia: 'Cierres', coste_unitario: 0.05 },
  { codigo: 'B-210', nombre: 'Tapón deportivo', familia: 'Cierres', coste_unitario: null },
  { codigo: 'C-300', nombre: 'Etiqueta frontal', familia: 'Etiquetas', coste_unitario: 0.02 },
  { codigo: 'C-310', nombre: 'Etiqueta trasera', familia: 'Etiquetas', coste_unitario: 0.02 },
]

const LINES = [
  { id_linea: 'L1', id_planta: 'P01', codigo: 'A-100', unidades_hora: 1800 },
  { id_linea: 'L2', id_planta: 'P01', codigo: 'A-150', unidades_hora: 1200 },
  { id_linea: 'L3', id_planta: 'P02', codigo: 'B-200', unidades_hora: 5000 },
  { id_linea: 'L4', id_planta: 'P02', codigo: 'B-210', unidades_hora: 3500 },
  { id_linea: 'L5', id_planta: 'P03', codigo: 'C-300', unidades_hora: 9000 },
  { id_linea: 'L6', id_planta: 'P03', codigo: 'C-310', unidades_hora: 9000 },
]

function buildDemand() {
  const rows = []
  const base = { 'A-100': 160000, 'A-150': 98000, 'B-200': 420000, 'B-210': 150000, 'C-300': 520000, 'C-310': 505000 }
  const plantOf = Object.fromEntries(LINES.map((l) => [l.codigo, l.id_planta]))
  for (const semana of [44, 45, 46, 47]) {
    for (const [codigo, units] of Object.entries(base)) {
      const factor = 1 + ((semana * 7 + codigo.charCodeAt(2)) % 9) / 40
      rows.push({ semana, id_planta: plantOf[codigo], codigo, unidades: Math.round(units * factor / 100) * 100 })
    }
  }
  // A demand on a plant with no line for the product: what the error check reports.
  rows.push({ semana: 46, id_planta: 'P03', codigo: 'A-150', unidades: 12000 })
  return rows
}

const DEMAND = buildDemand()

export const demoInstanceData = {
  plantas: PLANTS,
  productos: PRODUCTS,
  lineas: LINES,
  demanda: DEMAND,
  parametros: { horizonte_semanas: 4, nivel_servicio: 98, permitir_horas_extra: false },
}

export const demoInstanceChecks = {
  demanda_sin_linea: [{ semana: 46, id_planta: 'P03', codigo: 'A-150', unidades: 12000 }],
  productos_sin_coste: [{ codigo: 'B-210', nombre: 'Tapón deportivo' }],
}

function buildPlan() {
  const plan = []
  const usage = []
  const rate = Object.fromEntries(LINES.map((l) => [l.codigo, l]))
  for (const semana of [44, 45, 46, 47]) {
    const hoursByPlant = { P01: 0, P02: 0, P03: 0 }
    for (const d of DEMAND.filter((r) => r.semana === semana)) {
      const line = rate[d.codigo]
      if (!line || line.id_planta !== d.id_planta) continue
      const horas = Math.round((d.unidades / line.unidades_hora) * 10) / 10
      hoursByPlant[d.id_planta] += horas
      plan.push({ semana, id_planta: d.id_planta, id_linea: line.id_linea, codigo: d.codigo, unidades: d.unidades, horas })
    }
    for (const p of PLANTS) {
      const used = Math.round(hoursByPlant[p.id_planta] * 10) / 10
      usage.push({
        semana,
        id_planta: p.id_planta,
        horas_disponibles: p.horas_semana,
        horas_usadas: used,
        utilizacion: Math.round((used / p.horas_semana) * 1000) / 10,
      })
    }
  }
  return { plan, usage }
}

const { plan: PLAN, usage: USAGE } = buildPlan()

export const demoSolutionData = {
  plan_produccion: PLAN,
  uso_capacidad: USAGE,
}

export const demoSolutionChecks = {
  demanda_no_servida: [{ semana: 46, id_planta: 'P03', codigo: 'A-150', unidades: 12000 }],
}

/** KPI tables a backend may return beside the solution (`kpis` in GET /execution/<id>/data/). */
export const demoKpis = {
  kpis_resumen: [
    { indicador: 'Nivel de servicio', valor: 99.2, unidad: '%' },
    { indicador: 'Utilización media', valor: 81.4, unidad: '%' },
    { indicador: 'Horas extra', valor: 0, unidad: 'h' },
    { indicador: 'Coste total', valor: 318450, unidad: '€' },
  ],
}

// ─── Executions ───────────────────────────────────────────────────────────────

const solverOf = (i) => (i % 3 === 0 ? 'mip.gurobi' : 'mip.cbc')

/**
 * The executions of the history, newest first. `state` is Cornflow's execution state and
 * `log.status_code` the solution state (see executionStates / solutionStates in the app config).
 */
const EXECUTION_SEEDS = [
  { name: 'Plan semana 44 · ajuste', description: 'Tras la parada de la línea 2', at: '2026-10-21T08:48:00', state: 1, sol: 1, user: 1, minutes: 3 },
  { name: 'Plan semana 44', description: 'Plan base de la semana', at: '2026-10-21T07:12:00', state: 1, sol: 1, user: 2, minutes: 5 },
  { name: 'Plan semana 44 · sin horas extra', description: 'Escenario sin horas extra', at: '2026-10-20T15:40:00', state: 1, sol: 5, user: 3, minutes: 5 },
  { name: 'Prueba demanda alta', description: 'Demanda +20 % en envases', at: '2026-10-20T10:05:00', state: 1, sol: -1, user: 2, minutes: 1 },
  { name: 'Plan semana 43 · revisión', description: '', at: '2026-10-17T12:30:00', state: -1, sol: -3, user: 1, minutes: 0, message: 'The solver could not start: the time limit must be greater than zero' },
  { name: 'Plan semana 43', description: 'Plan base de la semana', at: '2026-10-14T07:02:00', state: 1, sol: 1, user: 2, minutes: 4 },
  { name: 'Plan semana 42', description: 'Plan base de la semana', at: '2026-10-07T07:05:00', state: 1, sol: 1, user: 2, minutes: 4 },
  { name: 'Plan semana 42 · sin planta sur', description: 'Escenario de mantenimiento', at: '2026-10-06T16:20:00', state: -4, sol: -4, user: 3, minutes: 0 },
  { name: 'Plan semana 41', description: 'Plan base de la semana', at: '2026-09-30T07:01:00', state: 1, sol: 1, user: 2, minutes: 6 },
  { name: 'Plan semana 40', description: 'Plan base de la semana', at: '2026-09-23T07:03:00', state: 1, sol: 2, user: 1, minutes: 5 },
]

function userById(id) {
  return demoUsers.find((u) => u.id === id) ?? demoUser
}

function addMinutes(iso, minutes) {
  const d = new Date(`${iso}Z`)
  d.setUTCMinutes(d.getUTCMinutes() + minutes)
  return d.toISOString().replace('Z', '').replace(/\.\d+$/, '.000000')
}

export const demoExecutions = EXECUTION_SEEDS.map((seed, i) => {
  const user = userById(seed.user)
  const id = `exec-${String(i + 1).padStart(3, '0')}`
  return {
    id,
    name: seed.name,
    description: seed.description,
    created_at: `${seed.at}.000000`,
    updated_at: addMinutes(seed.at, seed.minutes),
    state: seed.state,
    message: seed.message ?? (seed.state === 1 ? 'The execution has been solved correctly.' : ''),
    log: { status_code: seed.sol, sol_code: seed.sol === 1 || seed.sol === 2 || seed.sol === 5 ? 1 : 0 },
    config: { solver: solverOf(i), timeLimit: 300, rel_gap: 0.01, nivel_servicio: 98, permitir_horas_extra: seed.sol !== 5 },
    schema: DEMO_DAG,
    instance_id: `inst-${String(i + 1).padStart(3, '0')}`,
    data_hash: `hash-${i + 1}`,
    indicators: '',
    user_id: user.id,
    username: user.username,
    first_name: user.first_name,
    last_name: user.last_name,
  }
})

/** A running execution, for the states that follow an execution live. */
export const demoRunningExecution = {
  ...demoExecutions[0],
  id: 'exec-running',
  name: 'Plan semana 45',
  description: 'Plan base de la semana',
  created_at: '2026-10-21T09:26:00.000000',
  updated_at: '2026-10-21T09:26:00.000000',
  state: 0,
  message: '',
  log: null,
  instance_id: 'inst-running',
}

// ─── Master data (frontend automation) ────────────────────────────────────────

const plantRows = PLANTS.map((p, i) => ({ id: i + 1, codigo: p.id_planta, nombre: p.nombre, region: p.region, horas_semana: p.horas_semana, activa: true }))
const productRows = PRODUCTS.map((p, i) => ({ id: i + 1, codigo: p.codigo, nombre: p.nombre, familia: p.familia, coste_unitario: p.coste_unitario, activo: p.codigo !== 'C-310' }))
const calendarRows = [
  { id: 1, planta_id: 1, planta_nombre: 'Planta Norte', fecha: '2026-10-12', motivo: 'Festivo nacional' },
  { id: 2, planta_id: 3, planta_nombre: 'Planta Sur', fecha: '2026-10-26', motivo: 'Mantenimiento preventivo' },
  { id: 3, planta_id: 2, planta_nombre: 'Planta Centro', fecha: '2026-11-02', motivo: 'Inventario' },
  { id: 4, planta_id: 1, planta_nombre: 'Planta Norte', fecha: '2026-12-08', motivo: 'Festivo nacional' },
]

export const demoMasterRows = {
  plantas: plantRows,
  productos: productRows,
  calendario: calendarRows,
}

const crud = (base, extra = {}) => ({
  get_list: { url: `${base}/`, http_method: 'GET' },
  get_item: { url: `${base}/{idx}/`, http_method: 'GET' },
  post_item: { url: `${base}/`, http_method: 'POST' },
  put_item: { url: `${base}/{idx}/`, http_method: 'PUT' },
  delete_item: { url: `${base}/{idx}/`, http_method: 'DELETE' },
  post_bulk: { url: `${base}/bulk/`, http_method: 'POST' },
  post_update_bulk: { url: `${base}/bulk/`, http_method: 'PUT' },
  delete_bulk: { url: `${base}/bulk/`, http_method: 'DELETE' },
  overwrite_all: { url: `${base}/overwrite/`, http_method: 'POST' },
  download_excel_table: { url: `${base}/excel/`, http_method: 'GET' },
  ...extra,
})

export const demoFrontendAutomation = {
  available_automations: {
    sections: {
      'datos-maestros': { title: { es: 'Datos maestros', en: 'Master data' }, icon: 'mdi-database', order: 1 },
    },
    groups: {
      red: { title: { es: 'Red productiva', en: 'Production network' }, icon: 'mdi-factory', section: 'datos-maestros', order: 1 },
      catalogo: { title: { es: 'Catálogo', en: 'Catalogue' }, icon: 'mdi-package-variant', section: 'datos-maestros', order: 2 },
    },
    tables: {
      plantas: { title: { es: 'Plantas', en: 'Plants' }, group: 'red', order: 1, ...crud('/plantas') },
      calendario: { title: { es: 'Calendario de paradas', en: 'Downtime calendar' }, group: 'red', order: 2, ...crud('/calendario') },
      productos: { title: { es: 'Productos', en: 'Products' }, group: 'catalogo', order: 1, ...crud('/productos') },
    },
  },
  definitions: {
    plantas: {
      type: 'object',
      properties: {
        id: { type: 'integer', readOnly: true, title: 'Id' },
        codigo: { type: 'string', title: { es: 'Código', en: 'Code' } },
        nombre: { type: 'string', title: { es: 'Nombre', en: 'Name' } },
        region: { type: 'string', title: { es: 'Región', en: 'Region' }, choices: ['Norte', 'Centro', 'Sur'] },
        horas_semana: { type: 'number', title: { es: 'Horas por semana', en: 'Hours per week' } },
        activa: { type: 'boolean', title: { es: 'Activa', en: 'Active' } },
      },
      required: ['codigo', 'nombre', 'horas_semana'],
      order: ['codigo', 'nombre', 'region', 'horas_semana', 'activa'],
    },
    productos: {
      type: 'object',
      properties: {
        id: { type: 'integer', readOnly: true, title: 'Id' },
        codigo: { type: 'string', title: { es: 'Código', en: 'Code' } },
        nombre: { type: 'string', title: { es: 'Nombre', en: 'Name' } },
        familia: { type: 'string', title: { es: 'Familia', en: 'Family' } },
        coste_unitario: { type: 'number', title: { es: 'Coste unitario (€)', en: 'Unit cost (€)' } },
        activo: { type: 'boolean', title: { es: 'Activo', en: 'Active' } },
      },
      required: ['codigo', 'nombre'],
      order: ['codigo', 'nombre', 'familia', 'coste_unitario', 'activo'],
    },
    calendario: {
      type: 'object',
      properties: {
        id: { type: 'integer', readOnly: true, title: 'Id' },
        planta_id: { type: 'integer', title: { es: 'Planta', en: 'Plant' }, columns_to_join: ['planta_nombre'] },
        planta_nombre: { type: 'string', title: { es: 'Planta', en: 'Plant' }, join_from: 'plantas.nombre' },
        fecha: { type: 'string', format: 'date', title: { es: 'Fecha', en: 'Date' } },
        motivo: { type: 'string', title: { es: 'Motivo', en: 'Reason' } },
      },
      required: ['planta_id', 'fecha'],
      order: ['planta_nombre', 'fecha', 'motivo'],
    },
  },
  paths: {
    '/plantas/': { get: { parameters: [], responses: { default: { schema: { type: 'array', items: { $ref: '#/definitions/plantas' } } } } } },
    '/productos/': { get: { parameters: [], responses: { default: { schema: { type: 'array', items: { $ref: '#/definitions/productos' } } } } } },
    '/calendario/': {
      get: {
        parameters: [
          { name: 'fecha_gte', in: 'query', required: false, type: 'string', format: 'date', is_filter: true, filter_info: { filters_on: 'fecha', filter_type: 'datetime_gte', symmetric: 'fecha_lte' } },
          { name: 'fecha_lte', in: 'query', required: false, type: 'string', format: 'date', is_filter: true, filter_info: { filters_on: 'fecha', filter_type: 'datetime_lte', symmetric: 'fecha_gte' } },
        ],
        responses: { default: { schema: { type: 'array', items: { $ref: '#/definitions/calendario' } } } },
      },
    },
  },
}

export const demoLicences = [
  { library: 'vue', license: 'MIT', version: '3.5.39', author: 'Evan You', description: 'The progressive JavaScript framework', 'home page': 'https://vuejs.org' },
  { library: 'vuetify', license: 'MIT', version: '3.9.7', author: 'John Leider', description: 'Vue component framework', 'home page': 'https://vuetifyjs.com' },
  { library: 'pinia', license: 'MIT', version: '3.0.4', author: 'Eduardo San Martin Morote', description: 'Intuitive, type safe store for Vue', 'home page': 'https://pinia.vuejs.org' },
]
