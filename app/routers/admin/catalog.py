from fastapi import APIRouter, Depends, HTTPException

from app import schemas, storage
from app.security import require_admin

router = APIRouter(
    prefix="/api/v1/admin/catalog",
    tags=["Admin · Catalog"],
    dependencies=[Depends(require_admin)],
)


@router.post("/locations", response_model=schemas.Location, status_code=201)
def create_location(payload: schemas.LocationCreate):
    location = schemas.Location(**payload.model_dump())
    storage.locations[location.id] = location.model_dump()
    return location


@router.post("/services", response_model=schemas.Service, status_code=201)
def create_service(payload: schemas.ServiceCreate):
    if payload.location_id not in storage.locations:
        raise HTTPException(status_code=404, detail="Location not found")
    service = schemas.Service(**payload.model_dump())
    storage.services[service.id] = service.model_dump()
    return service


@router.post("/places", response_model=schemas.Place, status_code=201)
def create_place(payload: schemas.PlaceCreate):
    place = schemas.Place(**payload.model_dump())
    storage.places[place.id] = place.model_dump()
    return place
