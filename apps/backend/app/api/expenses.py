from datetime import date
from typing import Any, List, Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.api import deps
from app.db.database import get_db
from app.models.user import User
from app.models.expense import Expense
from app.models.farm import Farm
from app.models.satellite import EarthIntelligenceForecast
from app.services.expense_optimizer import analyze_expenses_with_ai
from app.services.activity_logger import log_activity

router = APIRouter()


# ─── Pydantic Schemas ────────────────────────────────────────────────────────

class CreateExpenseRequest(BaseModel):
    category: str  # Seeds | Fertilizers | Labor | Irrigation | Machinery | Transport | Miscellaneous
    amount: float
    description: Optional[str] = ""
    expense_date: Optional[date] = None
    crop: Optional[str] = ""
    notes: Optional[str] = ""


class ExpenseOut(BaseModel):
    id: int
    category: str
    amount: float
    description: Optional[str] = ""
    expense_date: date
    crop: Optional[str] = ""
    notes: Optional[str] = ""
    created_at: Any

    class Config:
        from_attributes = True


class OptimizerSuggestion(BaseModel):
    category: str
    issue: str
    solution: str
    saving_estimate: str


class ProfitabilityForecast(BaseModel):
    crop: str
    estimated_yield_tonnes: float
    market_price_per_qtl: float
    estimated_revenue: float
    net_margin: float


class OptimizationReport(BaseModel):
    overall_health: str  # Optimal | Action Required | Critical
    savings_opportunity: float
    suggestions: List[OptimizerSuggestion] = []
    profitability_forecast: ProfitabilityForecast


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.get("/", response_model=List[ExpenseOut])
def list_expenses(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
    category: Optional[str] = Query(None),
    crop: Optional[str] = Query(None),
    limit: int = Query(100, le=500),
    offset: int = Query(0),
) -> Any:
    """List user expenses with optional filters."""
    q = db.query(Expense).filter(Expense.user_id == current_user.id)
    if category:
        q = q.filter(Expense.category == category)
    if crop:
        q = q.filter(Expense.crop.ilike(f"%{crop}%"))

    return q.order_by(desc(Expense.expense_date), desc(Expense.created_at)).offset(offset).limit(limit).all()


@router.post("/", response_model=ExpenseOut, status_code=status.HTTP_201_CREATED)
def create_expense(
    *,
    payload: CreateExpenseRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Log an expense and auto-record it in the activity logs."""
    db_exp = Expense(
        user_id=current_user.id,
        category=payload.category,
        amount=payload.amount,
        description=payload.description or "",
        expense_date=payload.expense_date or date.today(),
        crop=payload.crop or "",
        notes=payload.notes or "",
    )
    db.add(db_exp)
    db.commit()
    db.refresh(db_exp)

    # Auto-log to activity log
    try:
        log_activity(
            db,
            user_id=current_user.id,
            activity_type="Expense",
            title=f"Logged Expense: {payload.category} - ₹{payload.amount:,.2f}",
            description=f"Category: {payload.category}. Amount: ₹{payload.amount:,.2f}. Details: {payload.description or 'None'}",
            crop=payload.crop or "",
            activity_date=db_exp.expense_date,
            source="auto",
            metadata={"expense_id": db_exp.id, "amount": payload.amount, "category": payload.category},
        )
    except Exception:
        pass

    return db_exp


@router.delete("/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_expense(
    expense_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> None:
    db_exp = db.query(Expense).filter(Expense.id == expense_id, Expense.user_id == current_user.id).first()
    if not db_exp:
        raise HTTPException(status_code=404, detail="Expense not found")
    db.delete(db_exp)
    db.commit()


@router.post("/optimize", response_model=OptimizationReport)
def optimize_expenses(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
    farm_size: float = Query(1.5),
    crop_context: Optional[str] = Query(""),
) -> Any:
    """
    Triggers Gemini spending analysis on all recorded expenses.
    Passes list size, crop context, and state.
    """
    expenses = db.query(Expense).filter(Expense.user_id == current_user.id).all()
    exp_dicts = [
        {"category": e.category, "amount": e.amount, "description": e.description}
        for e in expenses
    ]

    farm_context = [{"size": farm_size, "crop": crop_context}]

    report = analyze_expenses_with_ai(
        expenses=exp_dicts,
        farm_context=farm_context,
        user_state=current_user.state or "",
    )
    return report
