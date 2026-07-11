from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.auth import router as auth_router
from app.api.disease import router as disease_router
from app.api.advisor import router as advisor_router
from app.api.schemes import router as schemes_router
from app.db.database import engine, Base
from app.models.chat import ChatMessage # For schema bootstrapping

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

@app.get("/")
def root_redirect():
    return {"message": "Welcome to the AgriNexus AI API. Visit /docs for documentation."}

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "agrinexus-backend"}
