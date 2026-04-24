import fitz # PyMuPDF
import os
import uuid

def extract_pdf_data(pdf_path: str, output_image_dir: str):
    """
    Extracts text and images from a PDF page by page.
    Returns a list of chunks, where each chunk corresponds to a page
    and contains the text and any images extracted from that page.
    """
    doc = fitz.open(pdf_path)
    extracted_data = []
    
    for page_num in range(len(doc)):
        page = doc.load_page(page_num)
        
        # Extract text
        blocks = page.get_text("blocks")
        text_content = ""
        for b in blocks:
            if b[6] == 0: # This is a text block
                text_content += b[4] + "\n"
        
        # Extract images
        image_list = page.get_images(full=True)
        images_on_page = []
        for img_index, img in enumerate(image_list):
            xref = img[0]
            base_image = doc.extract_image(xref)
            if not base_image: continue
            
            image_bytes = base_image["image"]
            image_ext = base_image["ext"]
            
            image_filename = f"page_{page_num+1}_{uuid.uuid4().hex[:8]}.{image_ext}"
            image_filepath = os.path.join(output_image_dir, image_filename)
            
            with open(image_filepath, "wb") as f:
                f.write(image_bytes)
                
            images_on_page.append(image_filename)
            
        if text_content.strip() or images_on_page:
           extracted_data.append({
               "page": page_num + 1,
               "text": text_content.strip(),
               "images": images_on_page
           })
           
    return extracted_data
