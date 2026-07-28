from fastapi import APIRouter, Depends, Query, HTTPException
from typing import Optional
from sqlalchemy.orm import Session

from database import get_db
from models import User, Pharmacy
from routers.auth import get_current_user

router = APIRouter()

SCRIPTS = {
    "short": {
        "normal": "Hi, do you have {strength} {name} in stock?",
        "caregiver": "Hi, do you have {strength} {name} in stock for a child?",
        "grumpy": "Do you have {strength} {name}?",
        "grumpy_caregiver": "Do you have {strength} {name} for a child?",
    },
    "polite": {
        "normal": (
            "Hi, I'm a patient checking if you're able to facilitate a transfer for "
            "{strength} {name}. Is that something you currently have in stock?"
        ),
        "caregiver": (
            "Hi, I'm a parent checking if you're able to fill a prescription for "
            "{strength} {name} for my child. Do you currently have that in stock?"
        ),
        "grumpy": "Can you fill {strength} {name}? Do you have it in stock?",
        "grumpy_caregiver": "Can you fill {strength} {name} for a child? Is it in stock?",
    },
    "insurance": {
        "normal": (
            "Hi, I need to check stock availability and whether you accept {insurance} "
            "for a controlled substance transfer — {strength} {name}."
        ),
        "caregiver": (
            "Hi, I need to check stock and whether you accept {insurance} for a "
            "controlled substance for my child — {strength} {name}."
        ),
        "grumpy": "Do you have {strength} {name} and accept {insurance}?",
        "grumpy_caregiver": "Do you have {strength} {name} for a child and accept {insurance}?",
    },
}


@router.get("/")
def get_script(
    tone: str = Query("polite", description="short | polite | insurance"),
    grumpy: bool = Query(False, description="One-sentence version"),
    medication_name: Optional[str] = Query(None, description="Medication name to auto-fill (from the on-device profile)"),
    strength: Optional[str] = Query(None, description="Strength to auto-fill (from the on-device profile)"),
    is_child_profile: bool = Query(False, description="Whether the active on-device profile is a child's"),
    pharmacy_id: Optional[int] = Query(None, description="Pharmacy context (for pre-flight screen)"),
    insurance: Optional[str] = Query(None, description="Insurance name for insurance tone"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if tone not in SCRIPTS:
        raise HTTPException(status_code=400, detail=f"tone must be one of: {', '.join(SCRIPTS.keys())}")

    name = medication_name or "{medication name}"
    strength = strength or "{strength}"
    is_caregiver = current_user.caregiver_mode and is_child_profile
    ins = insurance or "{insurance}"

    tone_scripts = SCRIPTS[tone]
    variant = ("grumpy_caregiver" if grumpy and is_caregiver
               else "grumpy" if grumpy
               else "caregiver" if is_caregiver
               else "normal")

    text = tone_scripts[variant].format(name=name, strength=strength, insurance=ins)

    # Pharmacy context for pre-flight screen
    pharmacy_info = None
    if pharmacy_id:
        pharmacy = db.query(Pharmacy).filter(
            Pharmacy.id == pharmacy_id,
            Pharmacy.user_id == current_user.id,
        ).first()
        if pharmacy:
            pharmacy_info = {"name": pharmacy.name, "phone": pharmacy.phone}

    return {
        "tone": tone,
        "grumpy": grumpy,
        "text": text,
        "medication_name": name,
        "strength": strength,
        "pharmacy": pharmacy_info,
        "all_tones": {
            t: SCRIPTS[t]["caregiver" if is_caregiver else "normal"].format(
                name=name, strength=strength, insurance=ins
            )
            for t in SCRIPTS
        },
    }
