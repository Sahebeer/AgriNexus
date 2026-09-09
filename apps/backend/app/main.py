import sys
from pathlib import Path

# Ensure project root is in sys.path for ml package access
root_dir = Path(__file__).resolve().parents[3]
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.auth import router as auth_router
from app.api.disease import router as disease_router
from app.api.advisor import router as advisor_router
from app.api.schemes import router as schemes_router
from app.api.weather import router as weather_router
from app.api.prices import router as prices_router
from app.api.shopping import router as shopping_router
from app.api.calendar import router as calendar_router
from app.api.activity import router as activity_router
from app.api.expenses import router as expenses_router
from app.api.mandi import router as mandi_router
from app.api.farms import router as farms_router
from app.api.satellite import router as satellite_router
from app.api.satellite_maps import router as satellite_maps_router
from app.api.admin import router as admin_router
from app.db.database import engine, Base
from app.db.database import SessionLocal
from app.models.user import User # For schema bootstrapping
from app.models.chat import ChatMessage, ChatMessageFeedback # For schema bootstrapping
from app.models.scan import ScanLog # For schema bootstrapping
from app.models.shopping import ShoppingList, ShoppingListItem # For schema bootstrapping
from app.models.calendar import CropCalendar, CalendarEvent # For schema bootstrapping for dev)
from app.models.activity import ActivityLog # For schema bootstrapping
from app.models.expense import Expense # For schema bootstrapping
from app.models.mandi import MandiListing # For schema bootstrapping
from app.models.farm import Farm, SoilReport # For schema bootstrapping
from app.models.satellite import SatelliteObservation, EarthIntelligenceForecast # For schema bootstrapping

# Create database tables if they don't exist yet (automatic bootstrapping for dev)
try:
    Base.metadata.create_all(bind=engine)
    print("Database tables initialized successfully.")

    # Provision the dedicated local demonstration account and its complete
    # farm/Sentinel-1 SAR dataset on a fresh installation. The seed function
    # is idempotent and startup deliberately limits it to that demo account.
    from seed_demo_farm import seed_data_for_db
    _demo_session = SessionLocal()
    try:
        seed_data_for_db(_demo_session, include_all_users=False)
    finally:
        _demo_session.close()
except Exception as e:
    print(f"Database initialization failed or deferred: {e}")

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# Set CORS allowed origins matching localhost and private subnets (192.168.x.x, 172.x.x.x, 10.x.x.x)
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex="https?://(localhost|127\\.0\\.0\\.1|192\\.168\\.[0-9]+\\.[0-9]+|172\\.[0-9]+\\.[0-9]+\\.[0-9]+|10\\.[0-9]+\\.[0-9]+\\.[0-9]+)(:[0-9]+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(auth_router, prefix=f"{settings.API_V1_STR}/auth", tags=["auth"])
app.include_router(disease_router, prefix=f"{settings.API_V1_STR}/disease", tags=["disease"])
app.include_router(advisor_router, prefix=f"{settings.API_V1_STR}/advisor", tags=["advisor"])
app.include_router(schemes_router, prefix=f"{settings.API_V1_STR}/schemes", tags=["schemes"])
app.include_router(weather_router, prefix=f"{settings.API_V1_STR}/weather", tags=["weather"])
app.include_router(prices_router, prefix=f"{settings.API_V1_STR}/prices", tags=["prices"])
app.include_router(shopping_router, prefix=f"{settings.API_V1_STR}/shopping", tags=["shopping"])
app.include_router(calendar_router, prefix=f"{settings.API_V1_STR}/calendar", tags=["calendar"])
app.include_router(activity_router, prefix=f"{settings.API_V1_STR}/activity", tags=["activity"])
app.include_router(expenses_router, prefix=f"{settings.API_V1_STR}/expenses", tags=["expenses"])
app.include_router(mandi_router, prefix=f"{settings.API_V1_STR}/mandi", tags=["mandi"])
app.include_router(farms_router, prefix=f"{settings.API_V1_STR}/farms", tags=["farms"])
app.include_router(satellite_router, prefix=f"{settings.API_V1_STR}/satellite", tags=["satellite"])
app.include_router(satellite_maps_router, prefix=f"{settings.API_V1_STR}/satellite-maps", tags=["satellite-maps"])
app.include_router(admin_router, prefix=f"{settings.API_V1_STR}/admin", tags=["admin"])

@app.get("/")
def root_redirect():
    return {"message": "Welcome to the AgriNexus AI API. Visit /docs for documentation."}

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "agrinexus-backend"}
