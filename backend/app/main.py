from fastapi import FastAPI

app = FastAPI(title="Placement Week Scheduler")


@app.get("/health")
def health():
    return {"status": "ok"}
