import chromadb
from google import genai
import os

# Initialize ChromaDB locally
chroma_client = chromadb.PersistentClient(path="./chroma_db")
collection = chroma_client.get_or_create_collection(name="study_materials")

def add_to_knowledge_base(document_id: str, extracted_data: list, subject: str = "General"):
    """
    extracted_data is a list of dicts: {'page': int, 'text': str, 'images': list[str]}
    """
    documents = []
    metadatas = []
    ids = []
    
    for idx, chunk in enumerate(extracted_data):
        page = chunk['page']
        text = chunk['text']
        images = chunk['images']
        
        # We must push non-empty text to chromadb
        if not text.strip():
            text = f"[Image only page {page}]"
            
        documents.append(text)
        metadatas.append({
            "document_id": document_id,
            "page": page,
            "images": ",".join(images) if images else "",
            "subject": subject
        })
        ids.append(f"{document_id}_page_{page}_{idx}")
        
    if documents:
        collection.add(
            documents=documents,
            metadatas=metadatas,
            ids=ids
        )

def query_knowledge_base(query: str, api_key: str, subject: str = "General"):
    """
    Retrieve top K relevant chunks and generate a response.
    """
    results = collection.query(
        query_texts=[query],
        n_results=4,
        where={"subject": subject}
    )
    
    if not results['documents'][0]:
        return "No relevant study material found. Please upload a PDF.", []

    context_str = ""
    retrieved_images = set()
    
    for i in range(len(results['documents'][0])):
        text = results['documents'][0][i]
        meta = results['metadatas'][0][i]
        
        context_str += f"--- Page {meta['page']} ---\n{text}\n\n"
        
        if meta.get('images'):
            images_list = meta['images'].split(",")
            for img in images_list:
                if img.strip():
                    retrieved_images.add(img.strip())

    prompt = f"""
You are an intelligent study assistant for a student. 
Your goal is to summarize the following extracted text from the user's study materials based on their query, to decrease their cognitive workload.
Give a clear and brief matter without losing any important information from the source material.
Structure your response beautifully with markdown headings and bullet points.
If the text refers to diagrams, graphs, or tables, explicitly mention that the user should refer to the attached diagram.

Query: {query}

Materials:
{context_str}
"""
    try:
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt
        )
        answer = response.text
    except Exception as e:
        # Fallback to older model or print error
        try:
             response = client.models.generate_content(
                model='gemini-1.5-flash',
                contents=prompt
             )
             answer = response.text
        except Exception as inner_e:
             answer = f"Error generating response from Gemini API: {e}. Check your API key."
    
    return answer, list(retrieved_images)

def generate_document_overview(extracted_data: list, api_key: str):
    text_content = ""
    # Keep context concise to avoid huge prompts overhead
    for chunk in extracted_data[:30]:
        text_content += chunk['text'] + "\n\n"
        
    prompt = f"""
You are an intelligent study assistant. The user just uploaded a new study material.
Please provide:
1. A short textual overview of the important topics in a structured way (bullet points).
2. A visual overview using Mermaid.js syntax. CRITICAL: Keep it VERY small and crisp! Maximum depth of 3. Use very short phrases (2-4 words max) for nodes. Provide ONLY main headings as a visual tree (e.g. mindmap or graph TD).

Format your response exactly like this:
```markdown
[Your textual overview here]
```

```mermaid
graph TD
  [Your tree structure of topics here]
```

Extracted Text:
{text_content}
"""
    try:
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt
        )
        return response.text
    except Exception as e:
        return f"Could not generate overview. Error: {e}"
