import os
from pathlib import Path

try:
    import pymupdf4llm
except ImportError:
    print("Error: The 'pymupdf4llm' library is not installed.")
    print("Please run: pip install pymupdf4llm pymupdf")
    exit(1)

def extract_dietary_guidelines():
    """
    Specifically extracts 'Dietary Guidelines - India.pdf' using pymupdf4llm.
    This was the method that worked correctly for the user initially without memory issues.
    """
    input_file = Path("PDFs/Dietary Guidelines - India.pdf")
    output_dir = Path("Documents_MD")
    output_file = output_dir / "Dietary Guidelines - India.md"
    
    if not input_file.exists():
        print(f"Error: Could not find {input_file.absolute()}")
        return
        
    if not output_dir.exists():
        output_dir.mkdir(parents=True, exist_ok=True)
        
    print(f"Extracting: {input_file.name} (Size: {input_file.stat().st_size / (1024*1024):.2f} MB)")
    print("Using pymupdf4llm for extraction...")
    
    try:
        # Extract markdown content
        md_text = pymupdf4llm.to_markdown(str(input_file))
        
        # Add metadata
        metadata_header = f"---\nsource_document: {input_file.name}\ndomain: Lifestyle & Health\n---\n\n"
        final_content = metadata_header + md_text
        
        with open(output_file, "w", encoding="utf-8") as f:
            f.write(final_content)
            
        print(f"\nSuccess! Saved to {output_file.absolute()}")
        print(f"Output size: {output_file.stat().st_size / 1024:.2f} KB")
        
    except Exception as e:
        print(f"Error extracting {input_file.name}: {str(e)}")

# Make sure to handle the other large PDF that might have failed as well
def extract_other_large_pdf():
    input_file = Path("PDFs/03042025123437_Common-Lifestyle-Disorders-(NCDs)-and-ways-to-avoid-these-conditions-(8-Mar-2022).pdf")
    output_dir = Path("Documents_MD")
    output_file = output_dir / "03042025123437_Common-Lifestyle-Disorders-(NCDs)-and-ways-to-avoid-these-conditions-(8-Mar-2022).md"
    
    if not input_file.exists():
        return
        
    print(f"\nExtracting: {input_file.name}")
    try:
        md_text = pymupdf4llm.to_markdown(str(input_file))
        metadata_header = f"---\nsource_document: {input_file.name}\ndomain: Lifestyle & Health\n---\n\n"
        with open(output_file, "w", encoding="utf-8") as f:
            f.write(metadata_header + md_text)
        print(f"Success! Output size: {output_file.stat().st_size / 1024:.2f} KB")
    except Exception as e:
        pass

if __name__ == "__main__":
    extract_dietary_guidelines()
    extract_other_large_pdf()
