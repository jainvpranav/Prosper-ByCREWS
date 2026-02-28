import os
import sys
import glob
import math
from typing import List, Dict

# ── Suppress noisy TensorFlow/Keras warnings ──────────────────────────────────
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"
os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"

# ─────────────────────────────────────────────────────────────────────────────
# LOCAL EMBEDDINGS  (sentence-transformers)
# Fast, private, no API key needed.
# ─────────────────────────────────────────────────────────────────────────────
try:
    from sentence_transformers import SentenceTransformer
except ImportError:
    print("Error: run  pip install sentence-transformers  first.")
    sys.exit(1)

print("Loading local embedding model (all-MiniLM-L6-v2)…")
embedder = SentenceTransformer("all-MiniLM-L6-v2")

# ─────────────────────────────────────────────────────────────────────────────
# GENERATION  (Gemini via google-genai with streaming)
# ─────────────────────────────────────────────────────────────────────────────
try:
    from google import genai
except ImportError:
    print("Error: run  pip install google-genai  first.")
    sys.exit(1)

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    print("Error: GEMINI_API_KEY environment variable not set.")
    print("  Windows: $env:GEMINI_API_KEY='your_key_here'")
    sys.exit(1)

gemini_client = genai.Client(api_key=GEMINI_API_KEY)
CHAT_MODEL = "gemini-2.5-flash"


# ─────────────────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────────────────


def cosine_similarity(a: List[float], b: List[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    return dot / (na * nb) if na and nb else 0.0


def load_and_chunk(
    folder: str, chunk_size: int = 1500, overlap: int = 300
) -> List[str]:
    chunks = []
    files = glob.glob(os.path.join(folder, "*.md"))
    if not files:
        print(f"No markdown files found in '{folder}'.")
        return chunks
    for fp in files:
        with open(fp, encoding="utf-8") as fh:
            text = fh.read()
        start = 0
        while start < len(text):
            end = start + chunk_size
            if end < len(text):
                space_idx = text.find(" ", end, end + 50)
                if space_idx != -1:
                    end = space_idx
            chunks.append(text[start:end])
            start += chunk_size - overlap
    return chunks


def build_kb(chunks: List[str]) -> List[Dict]:
    print(f"Embedding {len(chunks)} chunks locally…")
    kb = []
    batch = 32
    for i in range(0, len(chunks), batch):
        b = chunks[i : i + batch]
        print(f"  Batch {i // batch + 1}/{math.ceil(len(chunks) / batch)}")
        vecs = embedder.encode(b)
        for chunk_text, vec in zip(b, vecs):
            kb.append({"text": chunk_text, "emb": vec.tolist()})
    print("Knowledge base ready.\n")
    return kb


def top_k(q_emb: List[float], kb: List[Dict], k: int = 5) -> List[str]:
    scored = sorted(kb, key=lambda d: cosine_similarity(q_emb, d["emb"]), reverse=True)
    return [d["text"] for d in scored[:k]]


def stream_answer(prompt: str) -> str:
    """Stream the Gemini response token-by-token and also return the full text.
    Retries automatically on 429 rate-limit errors with exponential backoff."""
    import time

    max_retries = 4
    delay = 10  # seconds
    for attempt in range(max_retries):
        try:
            full = []
            for chunk in gemini_client.models.generate_content_stream(
                model=CHAT_MODEL, contents=prompt
            ):
                token = chunk.text or ""
                print(token, end="", flush=True)
                full.append(token)
            print()  # newline after stream ends
            return "".join(full)
        except Exception as e:
            err_str = str(e)
            if "429" in err_str and attempt < max_retries - 1:
                wait = delay * (2**attempt)
                print(
                    f"\n[Rate limited — waiting {wait}s before retry {attempt + 1}/{max_retries - 1}…]"
                )
                time.sleep(wait)
            else:
                print(f"\n[Error from Gemini: {e}]")
                return ""
    return ""


# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────


def main():
    folder = "Documents_MD_Cleaned"
    if not os.path.exists(folder):
        print(f"Error: '{folder}' directory not found.")
        return

    chunks = load_and_chunk(folder)
    if not chunks:
        return
    kb = build_kb(chunks)

    print("=" * 60)
    print("Lifestyle & Health RAG Chatbot")
    print("Embeddings: local (all-MiniLM-L6-v2) | LLM: Gemini (streaming)")
    print("Type 'quit' or 'exit' to stop.")
    print("=" * 60 + "\n")

    history: List[Dict] = []

    while True:
        try:
            user_input = input("You: ").strip()
        except (KeyboardInterrupt, EOFError):
            print("\nGoodbye!")
            break

        if not user_input:
            continue
        if user_input.lower() in ("quit", "exit"):
            print("Goodbye!")
            break

        # Retrieve
        q_emb = embedder.encode([user_input])[0].tolist()
        top_k_val = top_k(q_emb, kb, k=5)
        print(top_k_val)
        context = "\n\n---\n\n".join(top_k_val)

        # Build history prefix (last 3 turns)
        hist_str = ""
        for t in history[-3:]:
            hist_str += f"User: {t['user']}\nAssistant: {t['model']}\n\n"

        prompt = (
            "You are a helpful Lifestyle & Health AI assistant.\n"
            "Answer clearly and concisely using ONLY the context below. "
            "If the answer isn't there, say you don't know based on these documents.\n\n"
            f"{hist_str}"
            f"CONTEXT:\n{context}\n\n"
            f"USER QUESTION: {user_input}\n\nANSWER:"
        )

        print("\nChatbot: ", end="", flush=True)
        answer = stream_answer(prompt)
        print("-" * 60 + "\n")

        history.append({"user": user_input, "model": answer})


if __name__ == "__main__":
    main()
