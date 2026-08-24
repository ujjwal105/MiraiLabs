from pydantic import BaseModel


class CompanyDelayRequest(BaseModel):
    company_id: int
    delay_hours: float


class PanelDropoutRequest(BaseModel):
    panel_id: int


class StudentWithdrawalRequest(BaseModel):
    student_id: int


class RoomUnavailableRequest(BaseModel):
    room_id: int
