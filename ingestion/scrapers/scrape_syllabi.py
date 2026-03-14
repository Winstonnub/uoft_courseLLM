import fitz # PyMuPDF
import os
import json

def parse_syllabi(pdf_directory):
    if not os.path.exists(pdf_directory):
        print(f"Directory {pdf_directory} does not exist. Please create it and add some PDF files.")
        return
        
    results = []
    
    print(f"Parsing PDFs in {pdf_directory}...")
    for filename in os.listdir(pdf_directory):
        if not filename.endswith(".pdf"):
            continue
            
        filepath = os.path.join(pdf_directory, filename)
        course_code = filename.split(".")[0].upper() # Assume file is named 'CSC311.pdf'
        
        try:
            doc = fitz.open(filepath)
            text_chunks = []
            
            # Very naive chunking by page for MVP RAG
            for page_num in range(len(doc)):
                page = doc.load_page(page_num)
                text = page.get_text()
                
                # Split into roughly 1000-character chunks
                chunk_size = 1000
                for i in range(0, len(text), chunk_size):
                    chunk = text[i:i+chunk_size].strip()
                    if len(chunk) > 50: # filter out tiny empty chunks
                        text_chunks.append({
                            "page": page_num + 1,
                            "content": chunk
                        })
                        
            results.append({
                "course_code": course_code,
                "chunks": text_chunks
            })
            print(f"Extracted {len(text_chunks)} chunks from {filename}")
        except Exception as e:
            print(f"Error parsing {filename}: {e}")
            
    os.makedirs("../raw_data", exist_ok=True)
    with open("../raw_data/parsed_syllabi.json", "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)
    print("Saved chunks to ingestion/raw_data/parsed_syllabi.json")

if __name__ == "__main__":
    sample_dir = "../raw_data/syllabi"
    os.makedirs(sample_dir, exist_ok=True)
    print(f"Please drop curriculum PDFs into {sample_dir} and run this script again.")
    parse_syllabi(sample_dir)
