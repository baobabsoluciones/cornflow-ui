# Funcionalidades de Cornflow UI

Qué ofrece la aplicación, contado desde lo que ve el usuario. Cada página explica para qué sirve una funcionalidad, enseña cómo se ve y dice cómo se activa: si es de core o de enterprise, qué clave de configuración la enciende y qué necesita del backend.

Está pensada para jefes de proyecto y preventa. Para configurar o programar, la referencia es el [README](../README.md) del repositorio.

Las funcionalidades de enterprise (plan actual, replanificación, recálculo de la solución, carga desde la base de datos y el agente) están en `docs/` del repositorio `cornflow_ui_enterprise`.

**Cómo leer «Cómo se activa»**

- **Core**: viene en `cornflow-ui` y la tiene cualquier aplicación. **Enterprise**: necesita un módulo de `cornflow_ui_enterprise`.
- `core.parameters.<clave>` es un ajuste del proyecto, en `src/app/config.ts`. Entre paréntesis va el valor de la plantilla con la que empieza cada proyecto.
- `values.json` (o las variables `VITE_APP_*`) es la configuración de cada despliegue: se cambia sin tocar el código.
- **Backend**: lo que tiene que dar el servidor. Cornflow es el servidor estándar; `/external/…` son endpoints del backend propio de la aplicación.

Las capturas se hacen con datos de demostración (ver [cómo se regeneran](../tests/e2e/docs-screenshots/README.md)).

## Acceso

| | Funcionalidad | |
| --- | --- | --- |
| <img src="images/inicio-de-sesion-foto.png" width="200" alt=""> | [Inicio de sesión](inicio-de-sesion.md) | Entrar con usuario de Cornflow, Microsoft o Google; cierre y caducidad de la sesión |
| <img src="images/pagina-no-encontrada-404.png" width="200" alt=""> | [Página no encontrada y acceso denegado](pagina-no-encontrada.md) | Qué ve el usuario en una dirección que no existe o sin permiso |

## La aplicación

| | Funcionalidad | |
| --- | --- | --- |
| <img src="images/menu-lateral-desplegado.png" width="200" alt=""> | [Menú lateral](menu-lateral.md) | La navegación: nueva ejecución, ejecución cargada, grupos y usuario |
| <img src="images/barra-de-pestanas.png" width="200" alt=""> | [Barra de pestañas](barra-de-pestanas.md) | Una pestaña por ejecución abierta |
| <img src="images/resumen-de-ejecucion-detalle.png" width="200" alt=""> | [Resumen de la ejecución](resumen-de-ejecucion.md) | De qué ejecución son los datos que se miran |
| <img src="images/varios-dags-selector.png" width="200" alt=""> | [Varios modelos en una aplicación](varios-dags.md) | Varios DAGs: selector de módulo y ajustes por módulo |
| <img src="images/entorno-de-pruebas.png" width="200" alt=""> | [Aviso de entorno de pruebas](entorno-de-pruebas.md) | Franja que avisa de que el entorno no es el de producción |
| <img src="images/avisos.png" width="200" alt=""> | [Avisos](avisos.md) | Avisos del backend en una campana |
| <img src="images/ayuda-menu.png" width="200" alt=""> | [Ayuda y recorridos guiados](ayuda.md) | Recorridos, manual de usuario y licencias |

La barra superior de la aplicación solo aparece cuando un módulo pone algo en ella. Ningún módulo de core ni de enterprise la usa; los avisos de enterprise (plan actual, replanificación) salen como franjas en lo alto.

## Historial de ejecuciones

| | Funcionalidad | |
| --- | --- | --- |
| <img src="images/historial-de-ejecuciones.png" width="200" alt=""> | [Historial de ejecuciones](historial-de-ejecuciones.md) | La lista de ejecuciones, su detalle y sus acciones |
| <img src="images/filtros-del-historial-anadir.png" width="200" alt=""> | [Filtros del historial](filtros-del-historial.md) | Búsqueda, fechas, estados y filtros propios del proyecto |
| <img src="images/estados-de-una-ejecucion.png" width="200" alt=""> | [Estados de una ejecución](estados-de-una-ejecucion.md) | Qué quiere decir cada estado de la ejecución y de la solución |

## Nueva ejecución

| | Funcionalidad | |
| --- | --- | --- |
| <img src="images/crear-ejecucion-datos-cargados.png" width="200" alt=""> | [Crear una ejecución](crear-ejecucion.md) | La pantalla completa, paso a paso |
| <img src="images/carga-de-datos-errores.png" width="200" alt=""> | [Carga de datos](carga-de-datos.md) | Traer los datos desde ficheros y ver sus errores |
| <img src="images/sincronizacion-con-tablas-maestras.png" width="200" alt=""> | [Sincronización con tablas maestras](sincronizacion-con-tablas-maestras.md) | Comparar los datos con las tablas de configuración |
| <img src="images/comprobaciones-de-datos-resultado.png" width="200" alt=""> | [Comprobaciones de datos](comprobaciones-de-datos.md) | Errores y avisos de los datos antes de lanzar |
| <img src="images/parametros-y-solver.png" width="200" alt=""> | [Parámetros y solver](parametros-y-solver.md) | Con qué se resuelve la ejecución |
| <img src="images/lanzar-ejecucion-en-curso.png" width="200" alt=""> | [Lanzar la ejecución](lanzar-ejecucion.md) | Nombre, qué falta, lanzar y seguirla en directo |
| <img src="images/borrador-de-ejecucion-salir.png" width="200" alt=""> | [Borrador de una ejecución](borrador-de-ejecucion.md) | Salir a medias y seguir más tarde |
| <img src="images/relanzar-ejecucion-copia-editable.png" width="200" alt=""> | [Relanzar una ejecución](relanzar-ejecucion.md) | Una ejecución nueva a partir de otra |
| <img src="images/modo-desarrollador.png" width="200" alt=""> | [Modo desarrollador](modo-desarrollador.md) | Crear una ejecución con una solución ya hecha |

## Ejecución cargada

| | Funcionalidad | |
| --- | --- | --- |
| <img src="images/datos-de-entrada.png" width="200" alt=""> | [Datos de entrada](datos-de-entrada.md) | Las tablas con las que se resolvió |
| <img src="images/resultados.png" width="200" alt=""> | [Resultados](resultados.md) | Las tablas de la solución |
| <img src="images/validaciones.png" width="200" alt=""> | [Validaciones](validaciones.md) | Las comprobaciones de los datos y de la solución |
| <img src="images/kpis.png" width="200" alt=""> | [KPIs](kpis.md) | Indicadores de la ejecución, como tablas |
| <img src="images/dashboards-automaticos.png" width="200" alt=""> | [Dashboards](dashboards.md) | Automáticos y a medida |
| <img src="images/historico-en-dashboards.png" width="200" alt=""> | [Histórico en dashboards](historico-en-dashboards.md) | Los datos de un periodo pasado en un dashboard |
| <img src="images/tablas-de-datos-filtro.png" width="200" alt=""> | [Tablas de datos](tablas-de-datos.md) | Buscar, filtrar, descargar y editar cualquier tabla |

## Tablas de configuración

| | Funcionalidad | |
| --- | --- | --- |
| <img src="images/tablas-de-configuracion.png" width="200" alt=""> | [Tablas de configuración](tablas-de-configuracion.md) | Los datos maestros: consultar, editar, carga masiva |
| <img src="images/cargar-todas-las-tablas-maestras.png" width="200" alt=""> | [Cargar todas las tablas maestras](cargar-todas-las-tablas-maestras.md) | Una carga para todas las tablas |

## Administración y cuenta

| | Funcionalidad | |
| --- | --- | --- |
| <img src="images/gestion-de-roles.png" width="200" alt=""> | [Gestión de roles](gestion-de-roles.md) | Roles y usuarios |
| <img src="images/pagina-no-encontrada-403.png" width="200" alt=""> | [Permisos por rol](permisos-por-rol.md) | Qué vistas ve cada rol y dónde empieza |
| <img src="images/ajustes-de-usuario.png" width="200" alt=""> | [Ajustes de usuario](ajustes-de-usuario.md) | Cuenta, tema, idioma y contraseña |

## Referencia técnica (en inglés)

- [Dashboards automáticos](AUTO_DASHBOARDS_README.md)
- [Pantallas de nueva ejecución a medida](create-execution-flows.md)
- [Backend de un despliegue con varios DAGs](backend-several-dags.md)
