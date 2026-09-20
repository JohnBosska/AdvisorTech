from uuid import UUID

from fastapi import APIRouter, HTTPException

from app import schemas, storage

router = APIRouter(prefix="/api/v1", tags=["Catalog"])


@router.get("/locations", response_model=list[schemas.Location])
def list_locations():
    return list(storage.locations.values())


@router.get("/locations/{location_id}", response_model=schemas.Location)
def get_location(location_id: UUID):
    location = storage.locations.get(location_id)
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")
    return location


@router.get("/services", response_model=list[schemas.Service])
def list_services(location_id: UUID | None = None):
    services = list(storage.services.values())
    if location_id:
        services = [s for s in services if s["location_id"] == location_id]
    return services


@router.get("/services/{service_id}", response_model=schemas.Service)
def get_service(service_id: UUID):
    service = storage.services.get(service_id)
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    return service


@router.get("/places", response_model=list[schemas.Place])
def list_places():
    return list(storage.places.values())


@router.get("/places/{place_id}", response_model=schemas.Place)
def get_place(place_id: UUID):
    place = storage.places.get(place_id)
    if not place:
        raise HTTPException(status_code=404, detail="Place not found")
    return place
