"""
A small planning app for the end-to-end suite of cornflow-ui.

It is not a model: it gives the interface every case it has to show. Its instance has a table
of products, a table of demand and a set of parameters. Its checks find errors (demand for a
product that does not exist) and warnings (a day without demand). Its solvers end every way an
execution can end:

- ``default`` plans the demand as it is, after ``seconds`` (2 by default);
- ``infeasible`` finds no solution;
- ``failing`` stops with an error.
"""

import json
import os
import time
from typing import Dict, List

from cornflow_client import ApplicationCore, ExperimentCore, InstanceCore, SolutionCore
from cornflow_client.constants import (
    SOLUTION_STATUS_FEASIBLE,
    SOLUTION_STATUS_INFEASIBLE,
    STATUS_INFEASIBLE,
    STATUS_OPTIMAL,
)

_HERE = os.path.dirname(__file__)


def _load(name: str) -> dict:
    with open(os.path.join(_HERE, name), encoding="utf-8") as file:
        return json.load(file)


class Instance(InstanceCore):
    schema = _load("schemas/input.json")
    schema_checks = _load("schemas/instance_checks.json")

    def check_unknown_products(self) -> List[Dict]:
        codes = {product["code"] for product in self.data["products"]}
        return [
            {"product": row["product"], "date": row["date"]}
            for row in self.data["demand"]
            if row["product"] not in codes
        ]

    def check_zero_demand(self) -> List[Dict]:
        return [
            {"product": row["product"], "date": row["date"]}
            for row in self.data["demand"]
            if row["quantity"] == 0
        ]


class Solution(SolutionCore):
    schema = _load("schemas/output.json")


class Planner(ExperimentCore):
    """Plans every unit asked for, at the product's cost."""

    schema_checks = _load("schemas/solution_checks.json")

    def solve(self, options: dict) -> dict:
        time.sleep(options.get("seconds", 2))
        costs = {p["code"]: p["unit_cost"] for p in self.instance.data["products"]}
        plan = [
            {
                "product": row["product"],
                "date": row["date"],
                "quantity": row["quantity"],
                "cost": row["quantity"] * costs.get(row["product"], 0),
            }
            for row in self.instance.data["demand"]
        ]
        self.solution = Solution({"plan": plan})
        return dict(status=STATUS_OPTIMAL, status_sol=SOLUTION_STATUS_FEASIBLE)

    def get_objective(self) -> float:
        return sum(row["cost"] for row in self.solution.data["plan"])

    def check_expensive_days(self) -> List[Dict]:
        per_day: Dict[str, float] = {}
        for row in self.solution.data["plan"]:
            per_day[row["date"]] = per_day.get(row["date"], 0) + row["cost"]
        return [{"date": day, "cost": cost} for day, cost in per_day.items() if cost > 1000]


class InfeasiblePlanner(Planner):
    """Finds no solution."""

    def solve(self, options: dict) -> dict:
        time.sleep(options.get("seconds", 2))
        self.solution = Solution({"plan": []})
        return dict(status=STATUS_INFEASIBLE, status_sol=SOLUTION_STATUS_INFEASIBLE)


class FailingPlanner(Planner):
    """Stops with an error."""

    def solve(self, options: dict) -> dict:
        time.sleep(options.get("seconds", 2))
        raise RuntimeError("The failing solver always fails")


class E2EPlanning(ApplicationCore):
    name = "e2e_planning"
    description = "Planning app for the end-to-end suite of cornflow-ui"
    instance = Instance
    solution = Solution
    solvers = dict(default=Planner, infeasible=InfeasiblePlanner, failing=FailingPlanner)
    schema = {
        "$schema": "http://json-schema.org/schema#",
        "type": "object",
        "properties": {
            "solver": {"type": "string", "enum": list(solvers.keys()), "default": "default"},
            "timeLimit": {"type": "number", "default": 60},
            "seconds": {"type": "number", "default": 2},
        },
    }

    @property
    def test_cases(self) -> List[Dict]:
        return [
            {
                "name": name,
                "instance": _load(os.path.join("data", f"{name}.json")),
                "description": description,
            }
            for name, description in (
                ("valid", "Data the checks find nothing in"),
                ("with_errors", "Demand for a product that does not exist"),
                ("with_warnings", "A day without demand"),
            )
        ]
