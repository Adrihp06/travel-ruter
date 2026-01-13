from sqlalchemy import Column, String, Float, JSON
from geoalchemy2 import Geometry
from app.models.base import BaseModel


class Route(BaseModel):
    __tablename__ = "routes"

    name = Column(String, nullable=False, index=True)
    description = Column(String, nullable=True)
    start_location = Column(String, nullable=False)
    end_location = Column(String, nullable=False)
    distance = Column(Float, nullable=True)
    duration = Column(Float, nullable=True)
    geometry = Column(Geometry('LINESTRING', srid=4326), nullable=True)
    metadata_json = Column(JSON, nullable=True)
