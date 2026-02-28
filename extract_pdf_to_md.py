import os
import argparse
from pathlib import Path

# Try importing docling
try:
    from docling.document_converter import DocumentConverter
    HAS_DOCLING = True
except ImportError:
    HAS_DOCLING = False
    print("Warning: The 'docling' library is not installed.")

# Try importing pymupdf4llm for fallback
try:
    import pymupdf4llm
    HAS_PYMUPDF = True
except ImportError:
    HAS_PYMUPDF = False
    print("Warning: The 'pymupdf4llm' library is not installed.")

if not HAS_DOCLING and not HAS_PYMUPDF:
    print("Error: Neither 'docling' nor 'pymupdf4llm' are installed.")
    print("Please run: pip install docling pymupdf4llm pymupdf")
    exit(1)

def convert_documents_to_md(input_dir: str, output_dir: str):
    """
    Scans the input directory for PDF and DOCX files and converts them to Markdown format.
    Uses docling primarily, but falls back to pymupdf4llm if docling runs out of memory (for large PDFs).
    """
    input_path = Path(input_dir)
    output_path = Path(output_dir)
    
    if not output_path.exists():
        output_path.mkdir(parents=True, exist_ok=True)
        print(f"Created output directory: {output_path.absolute()}")
        
    if not input_path.exists() or not input_path.is_dir():
        print(f"Error: Input directory '{input_path.absolute()}' does not exist.")
        return

    # Find PDFs and DOCX files
    files_to_process = []
    files_to_process.extend(input_path.glob("*.pdf"))
    files_to_process.extend(input_path.glob("*.docx"))
    
    if not files_to_process:
        print(f"No PDF or DOCX files found in {input_path.absolute()}")
        return
        
    print(f"Found {len(files_to_process)} file(s). Starting conversion for Lifestyle & Health RAG chatbot...")
    
    converter = None
    if HAS_DOCLING:
        converter = DocumentConverter()

    for file_path in files_to_process:
        print(f"\nProcessing: {file_path.name}")
        success = False
        md_text = ""
        
        # 1. Try Docling
        if HAS_DOCLING:
            print("  -> Attempting extraction with docling...")
            try:
                result = converter.convert(str(file_path))
                md_text = result.document.export_to_markdown()
                success = True
                print("  -> Docling extraction successful.")
            except Exception as e:
                print(f"  -> Docling extraction failed: {str(e)}")
                # For very large PDFs, docling might cause OOM errors (std::bad_alloc)
                # We will fall through to the fallback
        
        # 2. Fallback to PyMuPDF for PDFs
        if not success and file_path.suffix.lower() == ".pdf" and HAS_PYMUPDF:
            print("  -> Falling back to pymupdf4llm extraction...")
            try:
                md_text = pymupdf4llm.to_markdown(str(file_path))
                success = True
                print("  -> pymupdf4llm extraction successful.")
            except Exception as e:
                print(f"  -> pymupdf4llm extraction failed: {str(e)}")
                
        if success:
            # Add metadata
            metadata_header = f"---\nsource_document: {file_path.name}\ndomain: Lifestyle & Health\n---\n\n"
            final_content = metadata_header + md_text
            
            output_file = output_path / f"{file_path.stem}.md"
            try:
                with open(output_file, "w", encoding="utf-8") as f:
                    f.write(final_content)
                print(f"  -> Successfully created {output_file.name}")
            except Exception as e:
                print(f"  -> Error writing to {output_file.name}: {str(e)}")
        else:
            print(f"  -> Failed to convert {file_path.name} with all available methods.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Convert PDFs and DOCX to Markdown.")
    parser.add_argument("--input", type=str, default="PDFs", 
                        help="Path to the directory containing documents (default: 'PDFs')")
    parser.add_argument("--output", type=str, default="Documents_MD", 
                        help="Path to the output directory for MD files (default: 'Documents_MD')")
    
    args = parser.parse_args()
    
    convert_documents_to_md(args.input, args.output)
    print("\nAll conversions finished!")
