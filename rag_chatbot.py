import os
import glob
import math
from typing import List, Dict

try:
    from google import genai
except ImportError:
    print("Error: The 'google-genai' library is not installed.")
    print("Please run: pip install google-genai")
    exit(1)

# Ensure api key is set
api_key = os.environ.get("GEMINI_API_KEY")
if not api_key:
    print("Error: GEMINI_API_KEY environment variable not found.")
    print("Please set it before running this script.")
    print("  Windows: $env:GEMINI_API_KEY=\"your_key_here\"")
    exit(1)

# Initialize the Gemini client
client = genai.Client(api_key=api_key)
CHAT_MODEL = 'gemini-2.5-flash'
EMBED_MODEL = 'gemini-embedding-001'

def cosine_similarity(vec1: List[float], vec2: List[float]) -> float:
    """Computes the cosine similarity between two vectors."""
    dot_product = sum(a * b for a, b in zip(vec1, vec2))
    norm_vec1 = math.sqrt(sum(a * a for a in vec1))
    norm_vec2 = math.sqrt(sum(b * b for b in vec2))
    if norm_vec1 == 0 or norm_vec2 == 0:
        return 0.0
    return dot_product / (norm_vec1 * norm_vec2)

def load_and_chunk_documents(folder_path: str, chunk_size: int = 1500, overlap: int = 300) -> List[str]:
    """Loads documents from a folder and splits them into overlapping chunks."""
    chunks = []
    files = glob.glob(os.path.join(folder_path, '*.md'))
    if not files:
        print(f"No markdown files found in {folder_path}!")
        return chunks
        
    for file_path in files:
        with open(file_path, 'r', encoding='utf-8') as f:
            text = f.read()
            # Split into chunks
            start = 0
            while start < len(text):
                end = start + chunk_size
                # Avoid splitting words if possible
                if end < len(text) and " " in text[end:end+50]:
                    end += text[end:end+50].find(" ")
                    
                chunks.append(text[start:end])
                start += chunk_size - overlap
    return chunks

def build_knowledge_base(chunks: List[str]) -> List[Dict]:
    """Generates embeddings for all chunks to build the knowledge base."""
    print(f"Generating embeddings for {len(chunks)} text chunks...")
    knowledge_base = []
    
    # Embed chunks. In a robust setup, you might batch these and add retry logic.
    for i, chunk in enumerate(chunks):
        if i % 10 == 0:
            print(f"Embedding chunk {i + 1}/{len(chunks)}...")
        try:
            response = client.models.embed_content(
                model=EMBED_MODEL,
                contents=chunk
            )
            embedding = response.embeddings[0].values
            knowledge_base.append({
                "text": chunk,
                "embedding": embedding
            })
        except Exception as e:
            print(f"Error embedding chunk {i}: {e}")
            
    print("Knowledge base built successfully!\n")
    return knowledge_base

def retrieve_top_k(query_embedding: List[float], knowledge_base: List[Dict], k: int = 5) -> List[str]:
    """Retrieves the top K most similar chunks based on cosine similarity."""
    scored_chunks = []
    for item in knowledge_base:
        sim = cosine_similarity(query_embedding, item["embedding"])
        scored_chunks.append((sim, item["text"]))
        
    # Sort by similarity descending
    scored_chunks.sort(key=lambda x: x[0], reverse=True)
    
    # Return top K texts
    return [text for sim, text in scored_chunks[:k]]

def main():
    docs_folder = "Documents_MD_Cleaned"
    if not os.path.exists(docs_folder):
        print(f"Error: '{docs_folder}' directory not found in the current working directory.")
        return

    print("Loading documents and preparing RAG knowledge base...")
    chunks = load_and_chunk_documents(docs_folder, chunk_size=1500, overlap=300)
    
    if not chunks:
        print("No content to process. Exiting.")
        return
        
    knowledge_base = build_knowledge_base(chunks)
    if not knowledge_base:
        print("Failed to build knowledge base embeddings. Exiting.")
        return
    
    print("="*60)
    print("Welcome to the Lifestyle & Health RAG Chatbot!")
    print("I can answer your questions based on the cleansed documents.")
    print("Type 'quit' or 'exit' to end the conversation.")
    print("="*60 + "\n")
    
    # We maintain conversation history manually so we don't pollute the 
    # model's memory with the massive context texts from prior turns
    chat_history = []
    
    while True:
        try:
            user_input = input("You: ")
            if user_input.strip().lower() in ['quit', 'exit']:
                print("Goodbye!")
                break
                
            if not user_input.strip():
                continue
                
            # Embed user query
            query_response = client.models.embed_content(
                model=EMBED_MODEL,
                contents=user_input
            )
            query_emb = query_response.embeddings[0].values
            
            # Retrieve relevant chunks
            top_chunks = retrieve_top_k(query_emb, knowledge_base, k=5)
            context_text = "\n\n---\n\n".join(top_chunks)
            
            # Formulate the prompt with conversation history and context
            history_str = ""
            if chat_history:
                history_str = "Prior Conversation History:\n"
                for turn in chat_history[-3:]: # Keep last 3 turns
                    history_str += f"User: {turn['user']}\nAssistant: {turn['model']}\n"
                history_str += "\n"
            
            augmented_prompt = (
                f"You are a helpful Lifestyle & Health RAG chatbot.\n"
                f"Answer the user's question clearly and concisely using ONLY the provided document context below.\n"
                f"If the answer is not in the context, inform the user that you don't know based on these documents.\n"
                f"{history_str}"
                f"CONTEXT FROM DOCUMENTS:\n{context_text}\n\n"
                f"USER QUESTION: {user_input}\n"
                f"ANSWER:"
            )
            
            print("\nThinking...")
            
            response = client.models.generate_content(
                model=CHAT_MODEL,
                contents=augmented_prompt
            )
            
            answer = response.text
            print("\nChatbot:", answer)
            print("-" * 60 + "\n")
            
            # Save to local history
            chat_history.append({"user": user_input, "model": answer})
            
        except KeyboardInterrupt:
            print("\nGoodbye!")
            break
        except Exception as e:
            print(f"\nAn error occurred: {e}")

if __name__ == "__main__":
    main()
