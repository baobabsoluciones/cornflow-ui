# Backends of a deployment with several DAGs

What the core sends to the application backend, and what the backend should do with it, when a
deployment works with several DAGs. It is written for whoever builds the backend of such an
application: the frontend-automation tables, the executions list and the checks behind them.

A deployment works with several DAGs when its external configuration lists more than one in
`schema` (`VITE_APP_SCHEMA=dag_a,dag_b`, or an array in `values.json`). With a single DAG none of
what follows applies: the core sends the requests without `schema`, except the executions list,
which always carries it (see [The executions list](#the-executions-list)).

## In short

| Request                                                         | When                                                                                                         | `schema`            | What the backend does with it                                                       |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------- | ----------------------------------------------------------------------------------- |
| `GET /schema/` (Cornflow)                                       | After the login                                                                                              | No                  | Cornflow answers with the DAGs the user may use                                     |
| `GET /frontend-automation/`                                     | After the login                                                                                              | No                  | One configuration for every DAG; each table says on which DAGs it shows (`schemas`) |
| `get_list` of a table                                           | Showing a table, its pages, the referenced tables of joined columns, the options of a selector (`join_from`) | Yes, the active DAG | May return only the rows of that DAG                                                |
| `download_excel_table` of a table                               | Downloading a table                                                                                          | Yes, the active DAG | May export only the rows of that DAG                                                |
| Executions list (`GET /execution/` or `executionsListEndpoint`) | The history                                                                                                  | Yes, always         | Cornflow filters by it; an endpoint of the app should too                           |
| One row (`get_item`) and writes (`post_item`, `put_item`, …)    | Editing a table                                                                                              | No                  | The row's own data says which DAG it belongs to                                     |

A backend that ignores `schema` keeps working: it returns every row, as it would with a single
DAG. The parameter only lets it return less.

## Which DAGs the user has

Right after the login the core asks Cornflow `GET /schema/` and keeps the DAGs of the deployment
that Cornflow grants the user (Cornflow's DAG permissions). With one, the app opens on it; with
several, the user picks one in the module selector and can switch at any time; with none, the
app shows a no-access message.

This is Cornflow's, not the application backend's. The application backend still has to refuse
what a user may not do: the frontend only hides it (see [Permissions](#permissions)).

## Which tables each DAG shows

`GET /frontend-automation/` is asked once, without `schema`, and describes the tables of every
DAG. Each table declares on which DAGs it shows with `schemas` in `available_automations.tables`:

```json
{
  "available_automations": {
    "tables": {
      "plants": {
        "title": { "en": "Plants" },
        "get_list": { "url": "/plants/", "http_method": "GET" }
      },
      "demand": {
        "title": { "en": "Demand" },
        "schemas": ["dag_a", "dag_b"],
        "get_list": { "url": "/demand/", "http_method": "GET" },
        "download_excel_table": {
          "url": "/demand/excel/",
          "http_method": "GET"
        }
      },
      "safety_stock": {
        "title": { "en": "Safety stock" },
        "schemas": ["dag_b"],
        "get_list": { "url": "/safety-stock/", "http_method": "GET" }
      }
    }
  }
}
```

| `schemas`            | The table shows on  |
| -------------------- | ------------------- |
| Not declared         | Every DAG           |
| `["dag_b"]`          | `dag_b` only        |
| `["dag_a", "dag_b"]` | `dag_a` and `dag_b` |
| `[]`                 | No DAG              |

A table that shows on several DAGs (`plants` and `demand` above) is a **shared table**. Its rows
may apply to one DAG or another, and that is what `schema` in its lists is for.

## Lists and downloads of a table

Every list (`get_list`) and every download (`download_excel_table`) of a frontend-automation table
carries the active DAG as `schema`, the same name Cornflow takes in `GET /execution/?schema=`. It
goes next to the parameters the request already has:

```text
GET /demand/?schema=dag_a&limit=50&offset=0                 first page
GET /demand/?schema=dag_a&limit=50&offset=50&plant_id=3     next page, with a column filter
GET /demand/excel/?schema=dag_a&plant_id=3                  download: the filters, no page
GET /plants/?schema=dag_a                                   options of a selector (join_from: "plants.name")
```

The same lists feed every place a table's rows show up:

- the table of a frontend-automation section, and each page of its scroll when the list is paged
  on the server;
- the referenced tables of joined columns (`columns_to_join`), read to show a name instead of an id;
- the options of a selector fed by a table (`join_from`): an executions history filter or a
  pre-ETL parameter;
- the master tables matched against the data of an execution.

**What the backend should do**

- Read `schema` as optional. Without it (a single-DAG deployment, or a request that does not come
  from the core) return every row the user may see.
- With it, return only the rows that apply to that DAG. How depends on the data: in the example
  each DAG plans the plants of one type, so `demand` keeps the rows whose `plant_id` is a plant of
  that type, and `plants` keeps the plants of that type.
- Apply the same rule to the list and to its download, so the file holds what the table shows.
- Paging and filters apply on top of it: `limit` / `offset` count over the rows of the DAG.
- Do not reject query parameters you do not know. A list that validates its query with a strict
  schema (marshmallow `unknown = RAISE`, Pydantic `extra = "forbid"`) answers `422` to `schema`
  and the table stays empty. Declare `schema`, or exclude what you do not know.
- Do not name a column filter `schema`: it would receive the DAG name.
- A value that is not a DAG of the deployment may be refused with `400`; the core only sends the
  active DAG.

A sketch in Flask and marshmallow:

```python
from flask import request
from marshmallow import EXCLUDE, Schema, fields, validate

DAGS = ["dag_a", "dag_b"]
PLANT_TYPE_OF_DAG = {"dag_a": "assembly", "dag_b": "paint"}


class DemandListQuery(Schema):
    class Meta:
        unknown = EXCLUDE  # parameters the list does not know are ignored

    schema = fields.String(load_default=None, validate=validate.OneOf(DAGS))
    plant_id = fields.Integer(load_default=None)
    limit = fields.Integer(load_default=50)
    offset = fields.Integer(load_default=0)


def demand_rows():
    query = DemandListQuery().load(request.args)
    rows = Demand.query
    if query["schema"]:
        rows = rows.join(Plant).filter(Plant.type == PLANT_TYPE_OF_DAG[query["schema"]])
    if query["plant_id"] is not None:
        rows = rows.filter(Demand.plant_id == query["plant_id"])
    return rows.offset(query["offset"]).limit(query["limit"]).all()
```

## On a DAG switch

The core switches DAG without reloading the page. It closes the loaded executions, loads the
schema of the new DAG from Cornflow and builds the views again, so it asks again, with the new
`schema`:

- the table or the history on screen (a table from its first page);
- the referenced tables of joined columns, when a table that refers to them loads;
- the options of the selectors.

An answer that arrives late for the DAG left behind is dropped, so the backend does not need to
cancel anything. The tables that are not on screen are asked when the user opens them.

## The executions list

The history asks the executions of the active DAG, always with `schema`, also with a single DAG:

```text
GET /execution/?schema=dag_a&limit=100&creation_date_gte=2026-10-01&creation_date_lte=2026-10-31
```

By default it is Cornflow's `GET /execution/`, which filters by `schema`. An application that
filters the history by its own data (`executionFilters`, e.g. a plant) points the list at its own
endpoint with `executionsListEndpoint`. That endpoint receives the same parameters as
`GET /execution/` plus the picked filters (`&plant_id=3`), and answers with the same shape. It
has to filter by `schema` as Cornflow does: otherwise the history of one DAG lists the executions
of all of them.

## One row, and writes

Reading one row (`get_item`) and every write do not carry `schema`: `post_item`, `put_item`,
`patch_item`, `post_bulk`, `post_update_bulk`, `delete_item`, `delete_bulk`, `delete_all`,
`overwrite_all`, `restore_all` and the async uploads. The row's own data has to say which DAG it
applies to (in the example, its `plant_id`). A backend that needs the DAG to validate a write
derives it from the data.

## Permissions

The frontend hides the DAGs and tables the user may not use, but the backend decides. On a list
with `schema`, a backend that knows the user's DAG permissions can refuse a DAG the user does not
have (`403`) instead of filtering by it.

## Premium modules

Premium modules make requests of their own (for example, the ETL) and document whether they carry
the active DAG.
