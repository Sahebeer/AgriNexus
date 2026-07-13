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
from app.db.database import engine, Base
from app.models.chat import ChatMessage, ChatMessageFeedback # For schema bootstrapping
from app.models.scan import ScanLog # For schema bootstrapping
from app.models.shopping import ShoppingList, ShoppingListItem # For schema bootstrapping
from app.models.calendar import CropCalendar, CalendarEvent # For schema bootstrapping for dev)
from app.models.activity import ActivityLog # For schema bootstrapping
from app.models.expense import Expense # For schema bootstrapping
from app.models.mandi import MandiListing # For schema bootstrapping
from app.models.farm import Farm, SoilReport # For schema bootstrapping

# Create database tables if they don't exist yet (automatic bootstrapping for dev)
try:
    Base.metadata.create_all(bind=engine)
    print("Database tables initialized successfully.")
except Exception as e:
    print(f"Database initialization failed or deferred: {e}")

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# Set all CORS enabled origins
if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.BACKEND_CORS_ORIGINS,
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

@app.get("/")
def root_redirect():
    return {"message": "Welcome to the AgriNexus AI API. Visit /docs for documentation."}

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "agrinexus-backend"}
