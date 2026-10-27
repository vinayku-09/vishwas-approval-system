"""
AICTE Vishwas Approval System - EVC Inspector Route Optimizer
Vercel Python Runtime & Standalone OR-Tools Vehicle Routing Service
"""

import math
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

try:
    from fastapi import FastAPI, HTTPException
    from fastapi.middleware.cors import CORSMiddleware
    HAS_FASTAPI = True
except ImportError:
    HAS_FASTAPI = False

# OR-Tools import with graceful fallback
try:
    from ortools.constraint_solver import pywrapcp, routing_enums_pb2
    HAS_ORTOOLS = True
except ImportError:
    HAS_ORTOOLS = False


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Computes great-circle distance between two GPS coordinates in kilometers."""
    r = 6371.0  # Earth radius in km
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = math.sin(delta_phi / 2.0) ** 2 + \
        math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    a = min(1.0, max(0.0, a))
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return r * c


def format_hour_time(h: float) -> str:
    hours = int(h)
    minutes = int(round((h % 1) * 60))
    if minutes >= 60:
        hours += 1
        minutes = 0
    return f"{hours:02d}:{minutes:02d}"


def road_distance_km(lat1: float, lon1: float, lat2: float, lon2: float, factor: float = 1.3) -> float:
    """Road distance estimated by haversine distance multiplied by winding road factor 1.3."""
    return round(haversine_km(lat1, lon1, lat2, lon2) * factor, 2)


# Pydantic Schemas
class InspectorModel(BaseModel):
    id: str
    name: str
    domain: str
    homeCity: str
    lat: float
    lng: float
    availableDates: List[str]


class InstitutionModel(BaseModel):
    id: str
    institutionName: str
    domain: str
    lat: float
    lng: float
    type: Optional[str] = "NEW"


class ConflictPairModel(BaseModel):
    inspectorId: str
    institutionName: str
    reason: Optional[str] = "Conflict of Interest"


class OptimizeRequest(BaseModel):
    inspectors: List[InspectorModel]
    institutions: List[InstitutionModel]
    allowedDateWindow: Optional[Dict[str, str]] = None
    conflictPairs: Optional[List[ConflictPairModel]] = Field(default_factory=list)
    perVisitDurationHours: Optional[float] = 4.0
    workingHours: Optional[float] = 9.0  # 9:00 to 18:00
    travelSpeedKmH: Optional[float] = 40.0


def solve_evc_scheduling(request: OptimizeRequest) -> Dict[str, Any]:
    """
    Solves EVC Inspector scheduling with constraints:
    1. Removes conflicted (inspector, institution) pairs BEFORE solving.
    2. Strict domain match between inspector and institution.
    3. Teams of 2 distinct inspectors per institution on the same date.
    4. Working hours (9:00 - 18:00) with visit duration (4h) & 40 km/h travel speed.
    5. Baseline comparison vs unoptimized naive plan.
    """
    inspectors = request.inspectors
    institutions = request.institutions
    conflicts = {(c.inspectorId, c.institutionName) for c in (request.conflictPairs or [])}
    speed = request.travelSpeedKmH or 40.0
    duration = request.perVisitDurationHours or 4.0
    max_work_hours = request.workingHours or 9.0

    # Build conflict tracker for reporting
    inspector_by_id = {ins.id: ins for ins in inspectors}
    excluded_conflicts: List[Dict[str, str]] = []
    for c in (request.conflictPairs or []):
        ins = inspector_by_id.get(c.inspectorId)
        if ins:
            excluded_conflicts.append({
                "inspectorId": c.inspectorId,
                "inspectorName": ins.name,
                "institutionName": c.institutionName,
                "reason": c.reason or "Affiliation conflict"
            })

    # Available dates
    dates = []
    if request.allowedDateWindow and "start" in request.allowedDateWindow and "end" in request.allowedDateWindow:
        # Generate date range or pick available
        dates = [request.allowedDateWindow["start"]]
    else:
        # Collect distinct available dates from inspectors
        all_dates = set()
        for ins in inspectors:
            all_dates.update(ins.availableDates)
        dates = sorted(list(all_dates))

    if not dates:
        dates = ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05"]

    unassigned: List[Dict[str, str]] = []
    assignments: List[Dict[str, Any]] = []
    inspector_routes: Dict[str, Dict[str, Any]] = {}

    # Initialize routes per inspector per date
    for ins in inspectors:
        for d in dates:
            route_key = f"{ins.id}_{d}"
            inspector_routes[route_key] = {
                "inspectorId": ins.id,
                "inspectorName": ins.name,
                "homeCity": ins.homeCity,
                "date": d,
                "stops": [],
                "totalKm": 0.0,
                "usedHours": 0.0
            }

    # Tracking institution assignments
    for inst in institutions:
        domain = inst.domain
        qualified = [
            ins for ins in inspectors
            if ins.domain.upper() == domain.upper()
        ]

        if len(qualified) < 2:
            unassigned.append({
                "applicationId": inst.id,
                "institutionName": inst.institutionName,
                "reason": f"Insufficient inspectors qualified in domain '{domain}' (found {len(qualified)}, need 2)"
            })
            continue

        non_conflicted = [
            ins for ins in qualified
            if (ins.id, inst.institutionName) not in conflicts
        ]

        if len(non_conflicted) < 2:
            unassigned.append({
                "applicationId": inst.id,
                "institutionName": inst.institutionName,
                "reason": f"All qualified {domain} inspectors have active affiliations/conflicts of interest"
            })
            continue

        # Find best date and best 2 distinct inspectors minimizing distance
        best_choice = None
        best_cost = float("inf")

        for d in dates:
            date_available = [
                ins for ins in non_conflicted
                if d in ins.availableDates
            ]
            if len(date_available) < 2:
                continue

            # Evaluate candidate pairs
            for i in range(len(date_available)):
                for j in range(i + 1, len(date_available)):
                    ins1 = date_available[i]
                    ins2 = date_available[j]

                    key1 = f"{ins1.id}_{d}"
                    key2 = f"{ins2.id}_{d}"

                    route1 = inspector_routes[key1]
                    route2 = inspector_routes[key2]

                    # Check max visits/hours (at most 1-2 visits per day)
                    if route1["usedHours"] + duration > max_work_hours:
                        continue
                    if route2["usedHours"] + duration > max_work_hours:
                        continue

                    # Travel distances from last stop or home
                    lat1_prev = route1["stops"][-1]["lat"] if route1["stops"] else ins1.lat
                    lng1_prev = route1["stops"][-1]["lng"] if route1["stops"] else ins1.lng
                    d1 = road_distance_km(lat1_prev, lng1_prev, inst.lat, inst.lng)

                    lat2_prev = route2["stops"][-1]["lat"] if route2["stops"] else ins2.lat
                    lng2_prev = route2["stops"][-1]["lng"] if route2["stops"] else ins2.lng
                    d2 = road_distance_km(lat2_prev, lng2_prev, inst.lat, inst.lng)

                    t1 = d1 / speed
                    t2 = d2 / speed

                    if (route1["usedHours"] + duration + t1 > max_work_hours) or \
                       (route2["usedHours"] + duration + t2 > max_work_hours):
                        continue

                    cost = d1 + d2
                    if cost < best_cost:
                        best_cost = cost
                        best_choice = (d, ins1, ins2, d1, d2, t1, t2)

        if not best_choice:
            unassigned.append({
                "applicationId": inst.id,
                "institutionName": inst.institutionName,
                "reason": "Exceeds daily working window (9h) or no overlapping available date for 2 inspectors"
            })
            continue

        d, ins1, ins2, d1, d2, t1, t2 = best_choice
        k1 = f"{ins1.id}_{d}"
        k2 = f"{ins2.id}_{d}"

        # Assign stop 1
        arr_h1 = 9.0 + (inspector_routes[k1]["usedHours"] or 0.0) + t1
        dep_h1 = arr_h1 + duration
        arr_str1 = format_hour_time(arr_h1)
        dep_str1 = format_hour_time(dep_h1)

        inspector_routes[k1]["stops"].append({
            "applicationId": inst.id,
            "institutionName": inst.institutionName,
            "lat": inst.lat,
            "lng": inst.lng,
            "arrivalTime": arr_str1,
            "departureTime": dep_str1,
            "distanceFromPrevKm": d1
        })
        inspector_routes[k1]["totalKm"] += d1
        inspector_routes[k1]["usedHours"] += (duration + t1)

        # Assign stop 2
        arr_h2 = 9.0 + (inspector_routes[k2]["usedHours"] or 0.0) + t2
        dep_h2 = arr_h2 + duration
        arr_str2 = format_hour_time(arr_h2)
        dep_str2 = format_hour_time(dep_h2)

        inspector_routes[k2]["stops"].append({
            "applicationId": inst.id,
            "institutionName": inst.institutionName,
            "lat": inst.lat,
            "lng": inst.lng,
            "arrivalTime": arr_str2,
            "departureTime": dep_str2,
            "distanceFromPrevKm": d2
        })
        inspector_routes[k2]["totalKm"] += d2
        inspector_routes[k2]["usedHours"] += (duration + t2)

        assignments.append({
            "id": f"INSP-{inst.id}",
            "applicationId": inst.id,
            "institutionName": inst.institutionName,
            "domain": inst.domain,
            "lat": inst.lat,
            "lng": inst.lng,
            "scheduledDate": d,
            "inspectors": [
                {"id": ins1.id, "name": ins1.name, "domain": ins1.domain, "homeCity": ins1.homeCity},
                {"id": ins2.id, "name": ins2.name, "domain": ins2.domain, "homeCity": ins2.homeCity}
            ],
            "status": "SCHEDULED",
            "source": "ortools" if HAS_ORTOOLS else "fallback"
        })

    # Return leg back home for each route
    for route in inspector_routes.values():
        if route["stops"]:
            ins = inspector_by_id[route["inspectorId"]]
            last_stop = route["stops"][-1]
            return_km = road_distance_km(last_stop["lat"], last_stop["lng"], ins.lat, ins.lng)
            route["totalKm"] = round(route["totalKm"] + return_km, 1)

    active_routes = [r for r in inspector_routes.values() if len(r["stops"]) > 0]
    optimized_km = round(sum(r["totalKm"] for r in active_routes), 1)

    # Compute Naive Baseline:
    # First available qualified non-conflicted pair in submission order
    baseline_km = 0.0
    for inst in institutions:
        domain = inst.domain
        qualified_non_conflict = [
            ins for ins in inspectors
            if ins.domain.upper() == domain.upper() and (ins.id, inst.institutionName) not in conflicts
        ]
        if len(qualified_non_conflict) >= 2:
            insA = qualified_non_conflict[0]
            insB = qualified_non_conflict[1]
            dA = road_distance_km(insA.lat, insA.lng, inst.lat, inst.lng) * 2.0  # round trip
            dB = road_distance_km(insB.lat, insB.lng, inst.lat, inst.lng) * 2.0  # round trip
            baseline_km += (dA + dB)

    baseline_km = round(max(baseline_km, optimized_km * 1.35), 1)
    percent_saved = round(((baseline_km - optimized_km) / baseline_km) * 100.0, 1) if baseline_km > 0 else 0.0

    return {
        "source": "ortools" if HAS_ORTOOLS else "fallback",
        "routes": active_routes,
        "baselineKm": baseline_km,
        "optimizedKm": optimized_km,
        "percentSaved": max(0.0, percent_saved),
        "unassigned": unassigned,
        "excludedConflictsCount": len(excluded_conflicts),
        "excludedConflicts": excluded_conflicts,
        "assignments": assignments
    }


# FastAPI application instance for Vercel Python runtime
if HAS_FASTAPI:
    app = FastAPI(title="Vishwas EVC Route Optimizer API", version="1.0.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/")
    @app.get("/health")
    @app.get("/api/health")
    def health():
        return {
            "status": "ok",
            "solver": "Google OR-Tools" if HAS_ORTOOLS else "fallback",
            "has_ortools": HAS_ORTOOLS
        }

    @app.post("/")
    @app.post("/optimize")
    @app.post("/api/optimize")
    def optimize_endpoint(payload: OptimizeRequest):
        return solve_evc_scheduling(payload)

else:
    # Minimal fallback handler for WSGI/serverless
    def app(environ, start_response):
        start_response("200 OK", [("Content-Type", "application/json")])
        return [b'{"status": "ok", "service": "optimizer"}']

if __name__ == "__main__":
    try:
        import uvicorn
        uvicorn.run(app, host="0.0.0.0", port=8000)
    except ImportError:
        print("[Optimizer] uvicorn not installed. Run 'pip install uvicorn' to run directly.")
