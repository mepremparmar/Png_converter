import zlib
import struct
import os
import time
import base64
from io import BytesIO
from fastapi import FastAPI, UploadFile, Form, HTTPException
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
async def health_check():
    return {"status": "ok"}

def create_png_chunk(chunk_type: bytes, data: bytes) -> bytes:
    """Creates a valid PNG chunk."""
    chunk_len = struct.pack("!I", len(data))
    crc = zlib.crc32(chunk_type + data) & 0xFFFFFFFF
    chunk_crc = struct.pack("!I", crc)
    return chunk_len + chunk_type + data + chunk_crc

def encode_png_custom(img: Image.Image, zlib_strategy: int) -> bytes:
    """
    Manually encodes a PIL Image into a PNG byte stream using a specific zlib strategy.
    """
    # Force RGBA
    img = img.convert("RGBA")
    width, height = img.size
    
    # Construct IHDR chunk
    # Width(4), Height(4), Bit depth(1), Color type(1), Compression(1), Filter(1), Interlace(1)
    # Color type 6 represents RGBA
    ihdr_data = struct.pack("!IIBBBBB", width, height, 8, 6, 0, 0, 0)
    ihdr_chunk = create_png_chunk(b"IHDR", ihdr_data)
    
    # Prepare IDAT data (pixels)
    # Each scanline must be prefixed with a filter byte (0 = None)
    raw_pixels = img.tobytes()
    filtered_data = bytearray()
    
    bytes_per_row = width * 4
    for y in range(height):
        # Filter None
        filtered_data.append(0)
        start = y * bytes_per_row
        end = start + bytes_per_row
        filtered_data.extend(raw_pixels[start:end])
        
    # Compress with specific strategy
    compressor = zlib.compressobj(level=9, method=zlib.DEFLATED, wbits=15, memLevel=8, strategy=zlib_strategy)
    compressed_data = compressor.compress(filtered_data) + compressor.flush()
    
    idat_chunk = create_png_chunk(b"IDAT", compressed_data)
    
    # Construct IEND chunk
    iend_chunk = create_png_chunk(b"IEND", b"")
    
    # PNG signature
    signature = b"\x89PNG\r\n\x1A\n"
    
    return signature + ihdr_chunk + idat_chunk + iend_chunk

@app.post("/api/convert")
async def convert_image(file: UploadFile, algorithm: str = Form("simple")):
    try:
        start_time = time.time()
        
        # Map algorithm to zlib strategy
        strategy_map = {
            "huffman": zlib.Z_HUFFMAN_ONLY,
            "rle": zlib.Z_RLE,
            "simple": zlib.Z_DEFAULT_STRATEGY
        }
        
        strategy = strategy_map.get(algorithm, zlib.Z_DEFAULT_STRATEGY)
        
        # Read the uploaded image
        img_data = await file.read()
        if not img_data:
             raise Exception("File upload is empty")
             
        original_size = len(img_data)
        
        # Save the original uploaded image to the server
        os.makedirs("saved_images/uploads", exist_ok=True)
        original_filename = file.filename or "upload.img"
        with open(f"saved_images/uploads/{original_filename}", "wb") as f:
            f.write(img_data)
            
        try:
            img = Image.open(BytesIO(img_data))
            img_width, img_height = img.size
        except Exception as e:
            raise Exception(f"Failed to open image file: {str(e)}")
            
        # Encode using requested compression strategy
        try:
            png_bytes = encode_png_custom(img, strategy)
            converted_size = len(png_bytes)
        except Exception as e:
            raise Exception(f"Failed to encode image to PNG: {str(e)}")
        
        # Save the converted image to the server
        os.makedirs("saved_images/converted", exist_ok=True)
        converted_filename = f"converted_{algorithm}_{original_filename.split('.')[0]}.png"
        with open(f"saved_images/converted/{converted_filename}", "wb") as f:
            f.write(png_bytes)
            
        conversion_time = time.time() - start_time
        
        # Encode image to base64 to ensure it travels safely with stats in JSON
        base64_image = base64.b64encode(png_bytes).decode('utf-8')
        
        # Return everything in a single, standard JSON package
        return {
            "stats": {
                "original_size": original_size,
                "converted_size": converted_size,
                "conversion_time": conversion_time,
                "width": img_width,
                "height": img_height,
                "format": file.content_type or "image/unknown"
            },
            "image": f"data:image/png;base64,{base64_image}"
        }
    except Exception as e:
        print(f"CONVERSION ERROR: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
