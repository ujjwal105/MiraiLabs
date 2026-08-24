from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import dataset, disruptions, query

app = FastAPI(title="Placement Week Scheduler")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(dataset.router)
app.include_router(disruptions.router)
app.include_router(query.router)


@app.get("/health")
def health():
    return {"status": "ok"}
