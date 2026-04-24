# Cognitive Load

Cognitive Load is an intelligent study assistant that lets you upload PDF learning materials, extracts text and images, stores knowledge in a local ChromaDB vector store, and answers questions using Google Gemini.

## Features

- Upload PDF study materials via browser drag & drop
- Extract text and images from each PDF page using PyMuPDF
- Organize uploads by subject folders
- Store extracted content in a local ChromaDB knowledge base
- Ask subject-specific questions through a chat interface
- Show a short textual overview and a Mermaid visual overview for uploaded documents
- Display referenced images alongside AI answers

## Architecture

- `app.py`: FastAPI backend with `/api/upload` and `/api/chat`
- `extractor.py`: PDF text and image extraction using `fitz` (PyMuPDF)
- `rag.py`: ChromaDB ingestion, semantic retrieval, and Gemini-based response generation
- `static/`: Frontend UI for upload, subject management, overview, and chat
- `chroma_db/`: Persistent ChromaDB storage directory
- `extracted_images/`: Saved extracted images from PDFs

## Requirements

- Python 3.10+
- FastAPI
- Uvicorn
- chromadb
- google-genai
- pymupdf
- python-multipart

## Setup

1. Create and activate a Python virtual environment:

```bash
python -m venv venv
venv\Scripts\activate
```

2. Install dependencies:

```bash
pip install fastapi uvicorn chromadb google-genai pymupdf python-multipart
```

3. Ensure the following directories exist or are created automatically:

- `uploads/`
- `extracted_images/`
- `chroma_db/`
- `static/`

## Running the App

Start the server with:

```bash
python app.py
```

Then open your browser at:

```text
http://localhost:8000
```

## Usage

1. Enter your Google Gemini API key in the sidebar.
2. Add or select a subject folder.
3. Drag and drop PDF files into the upload area.
4. Wait for documents to be processed and overview content to appear.
5. Switch to the Q&A tab and ask questions about the uploaded materials.

## API Endpoints

### `POST /api/upload`

Upload a PDF file and optionally generate a document overview.

Request form fields:

- `file`: The PDF file to upload
- `api_key`: Optional Gemini API key to generate an overview
- `subject`: Subject folder label (default: `General`)

Response:

- `message`
- `file_id`
- `overview` (optional Mermaid + markdown overview)

### `POST /api/chat`

Ask a question against the stored knowledge base.

Request JSON body:

- `query`: User question
- `api_key`: Gemini API key
- `subject`: Subject folder label

Response:

- `answer`: AI-generated answer
- `images`: Array of image URLs referenced in the response

## Notes

- Only PDF uploads are supported currently.
- The app stores content locally in `chroma_db/` and extracted images in `extracted_images/`.
- The frontend is served from `static/` and is mounted by FastAPI.
- If Gemini fails, the app has a fallback attempt to a secondary model.

## License

This project is licensed under the terms of the repository license.
