import os
import shutil
import uuid
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import uvicorn
from fastapi.middleware.cors import CORSMiddleware
from extractor import extract_pdf_data
from rag import add_to_knowledge_base, query_knowledge_base, generate_document_overview

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create directories if they don't exist
UPLOAD_DIR = "uploads"
IMAGES_DIR = "extracted_images"
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(IMAGES_DIR, exist_ok=True)
os.makedirs("static", exist_ok=True)

# Mount directories for static files and extracted images
app.mount("/images", StaticFiles(directory=IMAGES_DIR), name="images")

@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...), api_key: str = Form(None), subject: str = Form("General")):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported currently.")
        
    file_id = uuid.uuid4().hex
    file_path = os.path.join(UPLOAD_DIR, f"{file_id}.pdf")
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    try:
        extracted_data = extract_pdf_data(file_path, IMAGES_DIR)
        add_to_knowledge_base(file_id, extracted_data, subject)
        
        overview = ""
        if api_key:
            overview = generate_document_overview(extracted_data, api_key)
            
        return JSONResponse(content={"message": "File processed successfully.", "file_id": file_id, "overview": overview})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class ChatRequest(BaseModel):
    query: str
    api_key: str
    subject: str = "General"

@app.post("/api/chat")
async def chat(request: ChatRequest):
    if not request.api_key:
        raise HTTPException(status_code=400, detail="API Key is required.")
        
    answer, images = query_knowledge_base(request.query, request.api_key, request.subject)
    
    image_urls = [f"/images/{img}" for img in images]
    
    return {"answer": answer, "images": image_urls}

app.mount("/", StaticFiles(directory="static", html=True), name="static")

if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
