from datetime import datetime
from pydantic import BaseModel


class EvidenceAnchorOut(BaseModel):
    id: int
    document_id: str
    sub_indicator: str
    verbatim_text: str
    page: int
    bounding_box: str | None
    confidence: float
    created_at: datetime

    model_config = {"from_attributes": True}


class DocumentOut(BaseModel):
    id: str
    filename: str
    file_path: str
    status: str
    created_at: datetime
    updated_at: datetime
    anchors: list[EvidenceAnchorOut] = []

    model_config = {"from_attributes": True}


class DocumentListOut(BaseModel):
    id: str
    filename: str
    file_path: str
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
