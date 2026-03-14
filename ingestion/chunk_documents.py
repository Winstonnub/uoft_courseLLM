import os
import sys
from dotenv import load_dotenv
from langchain_text_splitters import MarkdownTextSplitter
from langchain_openai import OpenAIEmbeddings

# Add backend directory to sys.path to access database
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'backend'))
from database import get_chroma_client

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(__file__), '..', 'backend', '.env'))

def embed_academic_rules():
    """Reads markdown files from general_academic_info, chunks them, and embeds into ChromaDB."""
    rules_dir = os.path.join(os.path.dirname(__file__), '..', 'general_academic_info')
    
    if not os.path.exists(rules_dir):
        print(f"Error: Directory {rules_dir} not found.")
        return
        
    md_files = [f for f in os.listdir(rules_dir) if f.endswith('.md')]
    if not md_files:
        print(f"No markdown files found in {rules_dir}.")
        return

    # Check for API key before calling OpenAI
    if not os.getenv("OPENAI_API_KEY") or os.getenv("OPENAI_API_KEY").startswith("sk-proj-YOUR_KEY"):
        print("Error: Valid OPENAI_API_KEY not found in backend/.env. Skipping embedding.")
        return

    # Initialize OpenAI Embeddings model
    # Note: Phase 1 plan recommended text-embedding-3-small
    embeddings_model = OpenAIEmbeddings(model="text-embedding-3-small")
    
    # Initialize Chroma DB collection
    client = get_chroma_client()
    collection = client.get_or_create_collection(name="academic_rules")
    
    # Simple chunker for Markdown text (splits by headers/paragraphs)
    splitter = MarkdownTextSplitter(chunk_size=1000, chunk_overlap=200)

    total_chunks = 0
    
    for filename in md_files:
        file_path = os.path.join(rules_dir, filename)
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
            
        print(f"Chunking {filename}...")
        
        # Split document into smaller, semantically coherent chunks
        chunks = splitter.create_documents([content])
        
        # Prepare data for Chroma
        texts = [chunk.page_content for chunk in chunks]
        metadatas = [{"source": filename, "chunk_index": i} for i in range(len(chunks))]
        ids = [f"{filename}_chunk_{i}" for i in range(len(chunks))]
        
        print(f"  -> Generated {len(chunks)} chunks. Embedding...")
        
        # Get embeddings via OpenAI
        embeddings = embeddings_model.embed_documents(texts)
        
        # Add to ChromaDB
        collection.add(
            ids=ids,
            embeddings=embeddings,
            metadatas=metadatas,
            documents=texts
        )
        total_chunks += len(chunks)

    print(f"Successfully embedded a total of {total_chunks} academic rules chunks into ChromaDB.")

if __name__ == "__main__":
    embed_academic_rules()
