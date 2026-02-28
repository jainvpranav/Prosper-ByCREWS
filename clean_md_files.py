import os
import glob
from pathlib import Path
import time

try:
    from google import genai
except ImportError:
    print("Error: The 'google-genai' library is not installed.")
    print("Please run: pip install google-genai")
    exit(1)

# To use this script, you must set an environment variable named GEMINI_API_KEY
# Alternatively, you can paste your key directly here (NOT RECOMMENDED for security reasons):
# api_key = "AIzaSy..."
api_key = os.environ.get("GEMINI_API_KEY")

if not api_key:
    print("Error: GEMINI_API_KEY environment variable not found.")
    print("Please set it before running this script.")
    print("  Windows: $env:GEMINI_API_KEY=\"your_key_here\"")
    exit(1)

# Initialize the new SDK client
client = genai.Client(api_key=api_key)

# Using gemini-2.5-flash with the new SDK
model_id = 'gemini-2.5-flash'

def clean_markdown_file(file_path: Path, output_file: Path):
    print(f"\nProcessing {file_path.name}...")
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
            
        print(f"  -> Input size: {len(content) / 1024:.2f} KB. Calling LLM...")
        
        prompt = f"""You are an expert AI data cleaner preparing data for a RAG chatbot. 
Your task is to take the following Markdown document and REMOVE all content that is NOT strictly relevant to the domain of "Lifestyle & Health".
This includes removing:
- Table of contents, bibliographies, acknowledgments, indexes, and administrative prefaces.
- Policies, highly technical regulatory jargon, or political statements not directly useful for general lifestyle/health advice.
- Completely off-topic sections.

KEEP all relevant information about diet, nutrition, exercise, daily habits, sickness prevention, mental health, and general lifestyle choices.
PRESERVE the original markdown formatting (headers, bullet points, bolding) of the content you keep. 
Do NOT summarize or rewrite the kept text; behave like a filter that just deletes irrelevant paragraphs/sections. 
If the entire document is relevant, output it as is. If none of it is relevant, output "NO RELEVANT CONTENT FOUND".

Here is the document:

{content}
"""
        # Call the Gemini API using the new client
        response = client.models.generate_content(
            model=model_id,
            contents=prompt,
        )
        cleaned_text = response.text
        
        with open(output_file, "w", encoding="utf-8") as f:
            f.write(cleaned_text)
            
        print(f"  -> Saved cleaned version to {output_file.name}")
        print(f"  -> Output size: {output_file.stat().st_size / 1024:.2f} KB")
        
    except Exception as e:
        print(f"  -> Error processing {file_path.name}: {str(e)}")

def main():
    input_dir = Path("Documents_MD")
    output_dir = Path("Documents_MD_Cleaned")
    
    if not output_dir.exists():
        output_dir.mkdir(parents=True)
        print(f"Created output directory: {output_dir.absolute()}")
        
    md_files = list(input_dir.glob("*.md"))
    if not md_files:
        print(f"No markdown files found in {input_dir.absolute()}")
        return
        
    print(f"Found {len(md_files)} Markdown files. Starting semantic cleaning...")
    
    for md_file in md_files:
        output_file = output_dir / f"cleaned_{md_file.name}"
        clean_markdown_file(md_file, output_file)
        # Sleep briefly to avoid aggressive rate-limiting depending on your tier
        time.sleep(2)
        
    print("\nAll files processed successfully!")

if __name__ == "__main__":
    main()
